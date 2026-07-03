/* ============================================================
   /api/admin — catalogue admin API (used by /admin.html)
   Auth: x-admin-key header must match the XANVOR_ADMIN_KEY env var.
   Actions (POST JSON {action, ...}):
     list                          → full catalogue + updated_at
     save    {product}             → upsert one product by id
     delete  {id}                  → remove one product
     upload-image {name, dataBase64} → store photo, returns {path}
   ============================================================ */
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getCatalog, saveCatalog } from './lib/catalog.mjs';

const COLLECTIONS = ['Silver & Gold', 'Copper', 'Brass', 'Sheesham & Wood', 'Wireform Furniture', 'Hot-Serve', 'Artisanal Serving Trays', 'Copper Home Collection', 'The Jewel Collection', 'Canister & Vanity Series', 'Ribbed Storage Collection'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const keysMatch = (a, b) => {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
};

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined; };

function cleanProduct(raw) {
  const id = str(raw.id, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) throw new Error('id must be like "fw-113" (letters, numbers, dashes)');
  const name = str(raw.name, 120);
  if (!name) throw new Error('name is required');
  const collection = str(raw.collection, 40);
  if (!COLLECTIONS.includes(collection)) throw new Error('unknown collection');
  const imgOk = (s) => s.startsWith('assets/') || s.startsWith('/img/');
  const image = str(raw.image, 200);
  if (image && !imgOk(image)) throw new Error('image must be an assets/ path or an uploaded /img/ path');
  /* gallery: images[] (max 8); first one is the primary shown on cards/feed */
  let images = Array.isArray(raw.images)
    ? raw.images.map(s => str(s, 200)).filter(Boolean).slice(0, 8) : [];
  for (const s of images) if (!imgOk(s)) throw new Error('har gallery image assets/ ya /img/ path honi chahiye');
  if (!images.length && image) images = [image];

  const p = {
    id, name, collection,
    code: str(raw.code, 40) || ('XV·' + id.toUpperCase().replace(/-/g, '·')),
    series: str(raw.series, 160),
    materials: str(raw.materials, 160),
    desc: str(raw.desc, 600),
    image: images[0] || image,
  };
  if (images.length) p.images = images;
  const opt = {
    construction: str(raw.construction, 120), sizes: str(raw.sizes, 160),
    moq: str(raw.moq, 60), hsn: str(raw.hsn, 20), tag: str(raw.tag, 60),
  };
  for (const [k, v] of Object.entries(opt)) if (v) p[k] = v;
  if (raw.signature) p.signature = true;

  const gst = str(raw.gst, 6);
  if (gst && !/^\d{1,2}%$/.test(gst)) throw new Error('gst must look like "18%"');
  if (gst) p.gst = gst;

  const mrp = num(raw.mrp), retail = num(raw.retail), offer = num(raw.offer);
  if (mrp) p.mrp = mrp;
  if (retail) p.retail = retail;
  if (offer) p.offer = offer;
  if ((retail || offer) && !mrp) throw new Error('retail/offer ke saath MRP zaroori hai (feed me dono jaate hain)');
  if (retail && mrp) {
    const incl = Math.round(retail * (1 + (parseFloat(gst || '18') / 100)));
    if (incl > mrp) throw new Error(`GST-inclusive price ₹${incl} MRP ₹${mrp} se zyada ho jayega — MRP badhao ya retail ghatao`);
  }
  if (raw.availability === 'out_of_stock') p.availability = 'out_of_stock';
  if (raw.status === 'draft') p.status = 'draft';
  if (raw.homepage === 'hide') p.homepage = 'hide';
  const homeOrder = Number(raw.home_order);
  if (Number.isFinite(homeOrder)) p.home_order = homeOrder;

  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights.map(h => str(h, 100)).filter(Boolean).slice(0, 8) : [];
  if (highlights.length) p.highlights = highlights;
  return p;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const adminKey = process.env.XANVOR_ADMIN_KEY;
  if (!adminKey) return json({ error: 'Setup needed: set the XANVOR_ADMIN_KEY environment variable in Netlify.' }, 503);
  const given = req.headers.get('x-admin-key') || '';
  if (!keysMatch(given, adminKey)) return json({ error: 'Galat admin key' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  try {
    if (body.action === 'list') {
      const cat = await getCatalog();
      return json(cat);
    }

    if (body.action === 'save') {
      const product = cleanProduct(body.product || {});
      const cat = await getCatalog();
      const products = [...cat.products];
      const i = products.findIndex(p => p.id === product.id);
      const now = new Date().toISOString();
      if (i >= 0) {
        products[i] = { ...products[i], ...product, modified_at: now };
        /* toggle fields: absent in the clean product means switched OFF — drop stale values */
        if (!product.status) delete products[i].status;
        if (!product.availability) delete products[i].availability;
        if (!product.signature) delete products[i].signature;
        if (!product.homepage) delete products[i].homepage;
      }
      else products.push({ ...product, modified_at: now });
      const saved = await saveCatalog(products, cat.collection_order);
      return json({ ok: true, count: saved.products.length, product });
    }

    if (body.action === 'reorder') {
      /* sets home_order = array index for each id, scoped to one collection —
         used by the admin list's ↑/↓ buttons to drive homepage card order */
      const collection = str(body.collection, 40);
      const ids = Array.isArray(body.ids) ? body.ids.map(x => str(x, 40)) : [];
      if (!collection || !ids.length) return json({ error: 'collection aur ids chahiye' }, 400);
      const cat = await getCatalog();
      const products = [...cat.products];
      ids.forEach((id, idx) => {
        const i = products.findIndex(p => p.id === id && p.collection === collection);
        if (i >= 0) products[i] = { ...products[i], home_order: idx };
      });
      const saved = await saveCatalog(products, cat.collection_order);
      return json({ ok: true, count: saved.products.length });
    }

    if (body.action === 'reorder-collections') {
      /* order = array of collection names in desired homepage-section sequence.
         Any valid collection not included is appended at the end (default
         COLLECTIONS order among themselves) so nothing silently disappears. */
      const incoming = Array.isArray(body.order) ? body.order.map(x => str(x, 40)) : [];
      const valid = incoming.filter(c => COLLECTIONS.includes(c));
      const missing = COLLECTIONS.filter(c => !valid.includes(c));
      const full = [...valid, ...missing];
      const cat = await getCatalog();
      const saved = await saveCatalog(cat.products, full);
      return json({ ok: true, collection_order: saved.collection_order });
    }

    if (body.action === 'delete') {
      const id = str(body.id, 40);
      const cat = await getCatalog();
      const products = cat.products.filter(p => p.id !== id);
      if (products.length === cat.products.length) return json({ error: 'id not found' }, 404);
      await saveCatalog(products, cat.collection_order);
      return json({ ok: true, count: products.length });
    }

    if (body.action === 'upload-image') {
      const rawName = str(body.name, 80).toLowerCase().replace(/[^a-z0-9.-]/g, '-');
      const ext = rawName.split('.').pop();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return json({ error: 'jpg/png/webp only' }, 400);
      const bytes = Buffer.from(String(body.dataBase64 || ''), 'base64');
      if (!bytes.length) return json({ error: 'empty image' }, 400);
      if (bytes.length > MAX_IMAGE_BYTES) return json({ error: 'image 5MB se badi hai' }, 413);
      const name = `${rawName.replace(/\.[^.]+$/, '')}-${Date.now().toString(36)}.${ext}`;
      const store = getStore('xanvor-images');
      await store.set(name, bytes);
      return json({ ok: true, path: `/img/${name}` });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: e.message || 'failed' }, 400);
  }
};

export const config = { path: '/api/admin' };

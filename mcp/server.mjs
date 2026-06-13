#!/usr/bin/env node
/* ============================================================
   XANVOR Catalog MCP — chat se poora catalogue manage karo.

   Tools: list_products, get_product, upsert_product,
          add_product_photos (resize + optional AI white-bg + 1:1),
          make_listing_images (white main + callouts + collage + hero,
            attach + optional go-live),
          set_product_status, delete_product

   Backend = https://xanvor.com/api/admin (Netlify functions + Blobs).
   Auth: env XANVOR_ADMIN_KEY (set at registration time).
   ============================================================ */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { whiteMain, renderCallouts, renderCollage, renderHero } from './listing.mjs';

const SITE = process.env.XANVOR_SITE || 'https://xanvor.com';
const KEY = process.env.XANVOR_ADMIN_KEY;

async function api(payload) {
  if (!KEY) throw new Error('XANVOR_ADMIN_KEY env var set nahi hai');
  const r = await fetch(`${SITE}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': KEY },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({ error: 'bad response' }));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

/* ---------------- image pipeline ---------------- */

const SQ = 1600;            // output square
const MARGIN = 0.07;        // subject margin in white-studio mode

async function loadNormalized(filePath) {
  const buf = await readFile(filePath);
  return sharp(buf).rotate().resize({ width: SQ, height: SQ, fit: 'inside', withoutEnlargement: true }).toBuffer();
}

async function squarePadWhite(buf) {
  const img = sharp(buf);
  const m = await img.metadata();
  const s = Math.max(m.width, m.height);
  return img
    .extend({
      top: Math.floor((s - m.height) / 2), bottom: Math.ceil((s - m.height) / 2),
      left: Math.floor((s - m.width) / 2), right: Math.ceil((s - m.width) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer();
}

let _removeBackground = null;
async function getRB() {
  if (_removeBackground) return _removeBackground;
  const m = await import('@imgly/background-removal-node');
  _removeBackground = m.removeBackground || m.default;
  return _removeBackground;
}

async function whiteStudio(buf) {
  const rb = await getRB();
  const cutBlob = await rb(new Blob([buf], { type: 'image/png' }));
  const cut = Buffer.from(await cutBlob.arrayBuffer());
  /* trim transparent edges → subject bbox */
  const subject = await sharp(cut).trim().toBuffer();
  const fit = Math.round(SQ * (1 - 2 * MARGIN));
  const resized = await sharp(subject)
    .resize({ width: fit, height: fit, fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const m = await sharp(resized).metadata();
  return sharp(resized)
    .extend({
      top: Math.floor((SQ - m.height) / 2), bottom: Math.ceil((SQ - m.height) / 2),
      left: Math.floor((SQ - m.width) / 2), right: Math.ceil((SQ - m.width) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function processAndUpload(filePath, productId, whiteBg) {
  const normalized = await loadNormalized(filePath);
  let out;
  let mode = whiteBg ? 'white-studio' : 'square';
  if (whiteBg) {
    try { out = await whiteStudio(normalized); }
    catch (e) { out = await squarePadWhite(normalized); mode = `square (AI fail hua: ${e.message})`; }
  } else {
    out = await squarePadWhite(normalized);
  }
  const up = await api({
    action: 'upload-image',
    name: `${productId}.jpg`,
    dataBase64: out.toString('base64'),
  });
  return { path: up.path, mode, kb: Math.round(out.length / 1024) };
}

/* ---------------- helpers ---------------- */

const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1) }] });
const brief = (p) => ({
  id: p.id, name: p.name, collection: p.collection,
  status: p.status || 'live',
  retail_incl_gst: p.retail ? Math.round(p.retail * (1 + (parseFloat(p.gst) || 18) / 100)) : null,
  mrp: p.mrp || null, photos: (p.images || (p.image ? [p.image] : [])).length,
});

async function getProductOrThrow(id) {
  const { products } = await api({ action: 'list' });
  const p = products.find(x => x.id === id);
  if (!p) throw new Error(`Product "${id}" catalogue me nahi mila`);
  return p;
}

/* ---------------- MCP server ---------------- */

const server = new McpServer({ name: 'xanvor-catalog', version: '1.0.0' });

server.tool(
  'list_products',
  'XANVOR catalogue ke products list karo (live + draft dono). Filters optional.',
  {
    collection: z.enum(['Silver & Gold', 'Copper', 'Brass', 'Sheesham & Wood', 'Wireform Furniture', 'Hot-Serve', 'Artisanal Serving Trays', 'Copper Home Collection', 'The Jewel Collection', 'Canister & Vanity Series', 'Ribbed Storage Collection']).optional(),
    status: z.enum(['live', 'draft']).optional(),
    q: z.string().optional().describe('naam/id me search'),
  },
  async ({ collection, status, q }) => {
    const { products, updated_at } = await api({ action: 'list' });
    let items = products;
    if (collection) items = items.filter(p => p.collection === collection);
    if (status) items = items.filter(p => (p.status || 'live') === status);
    if (q) { const s = q.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(s) || p.id.includes(s)); }
    return text({ total: items.length, updated_at, products: items.map(brief) });
  }
);

server.tool(
  'get_product',
  'Ek product ka poora record (saare fields + photo gallery).',
  { id: z.string() },
  async ({ id }) => text(await getProductOrThrow(id))
);

server.tool(
  'upsert_product',
  'Product banao ya update karo. Naya product DRAFT me banana best hai (status: draft) — photos lag jayein phir live karna. Sirf bheje gaye fields update hote hain; id zaroori hai. Price note: retail ex-GST hota hai, customer retail×(1+GST) pays; MRP tax-inclusive.',
  {
    id: z.string().describe('jaise fw-113 (lowercase, dash)'),
    name: z.string().optional(),
    collection: z.enum(['Silver & Gold', 'Copper', 'Brass', 'Sheesham & Wood', 'Wireform Furniture', 'Hot-Serve', 'Artisanal Serving Trays', 'Copper Home Collection', 'The Jewel Collection', 'Canister & Vanity Series', 'Ribbed Storage Collection']).optional(),
    series: z.string().optional(),
    materials: z.string().optional().describe('· se alag, jaise "Solid Brass · Hand-Hammered"'),
    desc: z.string().optional(),
    construction: z.string().optional(),
    sizes: z.string().optional(),
    moq: z.string().optional(),
    hsn: z.string().optional(),
    gst: z.enum(['18%', '12%', '5%']).optional(),
    tag: z.string().optional(),
    signature: z.boolean().optional(),
    mrp: z.number().optional(),
    retail: z.number().optional().describe('B2C price ex-GST'),
    offer: z.number().optional().describe('B2B/trade price ex-works'),
    highlights: z.array(z.string()).max(8).optional(),
    availability: z.enum(['in_stock', 'out_of_stock']).optional(),
    status: z.enum(['live', 'draft']).optional(),
  },
  async (args) => {
    const existing = await api({ action: 'list' }).then(d => d.products.find(p => p.id === args.id));
    const merged = { ...(existing || {}), ...args };
    if (args.availability === 'in_stock') delete merged.availability;
    if (args.status === 'live') delete merged.status;
    const out = await api({ action: 'save', product: merged });
    return text({ saved: true, was_existing: !!existing, product: brief(out.product), note: out.product.status === 'draft' ? 'DRAFT — website pe nahi dikhega jab tak live na karo' : 'LIVE — website/sitemap/Google feed sab pe ~1-5 min me' });
  }
);

server.tool(
  'add_product_photos',
  'Raw photos ko optimize karke product ki gallery me jodo. Har photo: EXIF-rotate + 1600px resize + (default) AI white studio background + 1:1 square + JPEG. white_bg=false par sirf square white padding. Pehli gallery photo MAIN hoti hai (cards/Google). Max 8 per product.',
  {
    id: z.string(),
    file_paths: z.array(z.string()).min(1).max(8).describe('local image file paths (jpg/png/webp)'),
    white_bg: z.boolean().default(true).describe('AI se background hata ke pure white studio look'),
    as_main: z.boolean().default(false).describe('pehli nayi photo ko MAIN bana do (gallery me sabse aage)'),
  },
  async ({ id, file_paths, white_bg, as_main }) => {
    const p = await getProductOrThrow(id);
    const gallery = Array.isArray(p.images) && p.images.length ? [...p.images] : (p.image ? [p.image] : []);
    const room = 8 - gallery.length;
    if (room <= 0) throw new Error('8 photos ki limit poori hai — pehle koi hatao (upsert images se)');
    const results = [];
    for (const fp of file_paths.slice(0, room)) {
      const abs = path.resolve(fp);
      results.push({ file: path.basename(abs), ...(await processAndUpload(abs, id, white_bg)) });
    }
    const newPaths = results.map(r => r.path);
    const images = as_main ? [...newPaths, ...gallery] : [...gallery, ...newPaths];
    await api({ action: 'save', product: { ...p, images, image: images[0] } });
    return text({
      added: results, gallery_now: images.length,
      skipped: file_paths.length > room ? file_paths.length - room : 0,
      note: (p.status === 'draft' ? 'Product DRAFT me hai — live karne pe dikhega.' : 'Website pe ~1 min me, Google feed agle fetch pe.'),
    });
  }
);

server.tool(
  'make_listing_images',
  'EK CALL ME poori listing: raw photo(s) se 1:1 white-studio main + Amazon-style callouts (product ke highlights se auto, ya diye gaye anchors par) + collage + hero banao, product ki gallery me lagao, aur chaaho to live kar do. callout_labels na do to product ke highlights use hote hain. Anchors (x,y 0-1600) do to callout wahan point karega, warna auto place. go_live=true par live (price na ho to warning ke saath).',
  {
    id: z.string(),
    source_files: z.array(z.string()).min(1).max(4).describe('raw product photo local paths; pehli = hero/main source'),
    templates: z.array(z.enum(['main', 'callouts', 'collage', 'hero'])).default(['main', 'callouts']).describe('kaunsi images banani hain'),
    callout_labels: z.array(z.object({ text: z.string(), x: z.number().optional(), y: z.number().optional() })).optional().describe('callout text + optional anchor (x,y in 0-1600); skip = product highlights auto'),
    white_bg: z.boolean().default(true),
    replace: z.boolean().default(false).describe('purani gallery hata ke nayi lagao'),
    go_live: z.boolean().default(false).describe('banane ke baad product live kar do'),
  },
  async ({ id, source_files, templates, callout_labels, white_bg, replace, go_live }) => {
    const p = await getProductOrThrow(id);
    const whites = [];
    for (const f of source_files.slice(0, 4)) whites.push(await whiteMain(path.resolve(f), { whiteBg: white_bg }));
    const main = whites[0];
    const labels = (callout_labels && callout_labels.length ? callout_labels : (p.highlights || []).map(t => ({ text: t }))).slice(0, 6);
    if (templates.includes('callouts') && !labels.length) throw new Error('callouts ke liye highlights/labels chahiye — product me highlights daalo ya callout_labels do');

    const built = [];
    for (const tpl of templates) {
      if (tpl === 'main') built.push(['main', main.buf]);
      else if (tpl === 'callouts') built.push(['callouts', await renderCallouts(main.buf, main.prod, labels)]);
      else if (tpl === 'collage') built.push(['collage', await renderCollage(whites.map(w => w.buf), p.name)]);
      else if (tpl === 'hero') built.push(['hero', await renderHero(main.buf, p.name, p.highlights || [])]);
    }
    const existing = replace ? [] : (Array.isArray(p.images) && p.images.length ? [...p.images] : (p.image ? [p.image] : []));
    const room = 8 - existing.length;
    const uploaded = [];
    for (const [tpl, buf] of built.slice(0, room)) {
      const up = await api({ action: 'upload-image', name: `${id}-${tpl}.jpg`, dataBase64: buf.toString('base64') });
      uploaded.push({ template: tpl, path: up.path, kb: Math.round(buf.length / 1024) });
    }
    const images = [...existing, ...uploaded.map(u => u.path)].slice(0, 8);
    const merged = { ...p, images, image: images[0] };
    const priced = !!(p.retail || p.offer);
    if (go_live) delete merged.status;
    await api({ action: 'save', product: merged });
    return text({
      id, made: uploaded, gallery_now: images.length, used_ai_whitebg: main.usedAI,
      callouts_from: (callout_labels && callout_labels.length) ? 'given' : 'product highlights',
      status: go_live ? 'live' : (p.status || 'live'),
      warning: go_live && !priced ? '⚠ Product me price nahi hai — live to ho gaya par retail buybox nahi dikhega. set_product_status se draft kar sakte ho, ya pehle pricing daalo.' : undefined,
      note: go_live ? 'Live — website/sitemap/Google feed pe ~1-5 min me.' : 'Gallery me lag gayi; abhi ' + (p.status || 'live') + '. Live karne ko go_live ya set_product_status.',
    });
  }
);

server.tool(
  'set_product_status',
  'Product ko live karo ya draft me chhupao.',
  { id: z.string(), status: z.enum(['live', 'draft']) },
  async ({ id, status }) => {
    const p = await getProductOrThrow(id);
    const merged = { ...p };
    if (status === 'draft') merged.status = 'draft'; else delete merged.status;
    await api({ action: 'save', product: merged });
    return text({ id, status, note: status === 'live' ? 'Ab website/sitemap/Google feed sab pe aayega' : 'Website/Google se hat gaya, admin me DRAFT chip ke saath hai' });
  }
);

server.tool(
  'delete_product',
  'Product catalogue se PERMANENTLY hatao (website, sitemap, Google feed sab se). Pehle user se confirm karna.',
  { id: z.string() },
  async ({ id }) => {
    const out = await api({ action: 'delete', id });
    return text({ deleted: id, remaining: out.count });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

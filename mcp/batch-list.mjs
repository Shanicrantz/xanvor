/* One-shot bulk lister: /tmp/listing_master.json + ref images →
   32 DRAFT products on the live catalogue with AI white-bg photos.
   Run from mcp/ (uses its node_modules):
     XANVOR_ADMIN_KEY=... node batch-list.mjs "<images dir>" */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://xanvor.com';
const KEY = process.env.XANVOR_ADMIN_KEY;
const IMG_DIR = process.argv[2];
const DATA = JSON.parse(await readFile('/tmp/listing_master.json', 'utf8'));

async function api(payload) {
  const r = await fetch(`${SITE}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': KEY },
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({ error: 'bad response' }));
  if (!r.ok) throw new Error(d.error || r.status);
  return d;
}

/* ---- image pipeline (same as MCP server) ---- */
const SQ = 1600, MARGIN = 0.07;
let _rb = null;
const getRB = async () => _rb || (_rb = (await import('@imgly/background-removal-node')).removeBackground);

async function whiteStudio(buf) {
  const rb = await getRB();
  const cutBlob = await rb(new Blob([await sharp(buf).png().toBuffer()], { type: 'image/png' }));
  const subject = await sharp(Buffer.from(await cutBlob.arrayBuffer())).trim().toBuffer();
  const fit = Math.round(SQ * (1 - 2 * MARGIN));
  const resized = await sharp(subject).resize({ width: fit, height: fit, fit: 'inside' }).toBuffer();
  const m = await sharp(resized).metadata();
  return sharp(resized).extend({
    top: Math.floor((SQ - m.height) / 2), bottom: Math.ceil((SQ - m.height) / 2),
    left: Math.floor((SQ - m.width) / 2), right: Math.ceil((SQ - m.width) / 2),
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
}
async function squarePad(buf) {
  const m = await sharp(buf).metadata();
  const s = Math.max(m.width, m.height);
  return sharp(buf).extend({
    top: Math.floor((s - m.height) / 2), bottom: Math.ceil((s - m.height) / 2),
    left: Math.floor((s - m.width) / 2), right: Math.ceil((s - m.width) / 2),
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
}

/* ---- field mapping ---- */
const PROPER = { moradabad: 'Moradabad', india: 'India', xanvor: 'XANVOR' };
const shortHighlight = (bullet) => {
  if (!bullet) return '';
  let head = String(bullet).split(' - ')[0].trim();
  head = head.toLowerCase().replace(/\b[a-z]/, c => c.toUpperCase());
  head = head.replace(/\b(moradabad|india|xanvor)\b/gi, m => PROPER[m.toLowerCase()]);
  return head.slice(0, 100);
};
const mapId = (sku) => sku.toLowerCase().replace(/^xv-/, '').replace(/^cu-/, 'ch-');
const mapHsn = (h) => (String(h || '').match(/\d{4}(?:\.\d+)?/) || [''])[0];

const results = [];
for (const row of DATA) {
  const sku = row['SKU'];
  const id = mapId(sku);
  const t0 = Date.now();
  try {
    const product = {
      id,
      code: 'XV·' + id.toUpperCase().replace(/-/g, '·'),
      name: row['Product Name'],
      collection: row['Website Category'],
      series: row['Collection'],
      materials: String(row['Material'] || '').replace(/, /g, ' · '),
      desc: row['Short Description (D2C)'],
      tag: row['Finish / Colour'],
      gst: row['GST'],
      hsn: mapHsn(row['HSN (suggested)']),
      status: 'draft',
      highlights: [1, 2, 3, 4, 5].map(i => shortHighlight(row[`Bullet ${i}`])).filter(Boolean),
    };
    const dims = String(row['Dimensions (approx)'] || '');
    if (dims && dims !== 'TBC') product.sizes = dims;

    /* photo: white-studio with square fallback */
    const imgFile = path.join(IMG_DIR, `${sku}-ref.jpg`);
    const raw = await readFile(imgFile);
    const normalized = await sharp(raw).rotate().resize({ width: SQ, height: SQ, fit: 'inside', withoutEnlargement: true }).toBuffer();
    let out, mode = 'studio';
    try { out = await whiteStudio(normalized); }
    catch (e) { out = await squarePad(normalized); mode = 'square-fallback'; }
    const up = await api({ action: 'upload-image', name: `${id}.jpg`, dataBase64: out.toString('base64') });

    product.image = up.path;
    product.images = [up.path];
    await api({ action: 'save', product });
    results.push({ id, ok: true, mode, kb: Math.round(out.length / 1024), s: ((Date.now() - t0) / 1000).toFixed(1) });
    console.log(`OK  ${id}  (${mode}, ${Math.round(out.length / 1024)}KB, ${((Date.now() - t0) / 1000).toFixed(1)}s)  ${product.name}`);
  } catch (e) {
    results.push({ id, ok: false, err: e.message });
    console.log(`FAIL ${id}: ${e.message}`);
  }
}
const ok = results.filter(r => r.ok).length;
console.log(`\nDONE: ${ok}/${results.length} drafts created`);
const { products } = await api({ action: 'list' });
console.log('catalogue total:', products.length, '| drafts:', products.filter(p => p.status === 'draft').length);

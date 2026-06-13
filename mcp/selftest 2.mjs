/* Self-test: draft product banao → photo (square + AI white-bg) jodo → verify → delete.
   Run: XANVOR_ADMIN_KEY=... node selftest.mjs <image-path> */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const SITE = 'https://xanvor.com';
const KEY = process.env.XANVOR_ADMIN_KEY;
const IMG = process.argv[2];
const ID = 'zz-mcp-test';

async function api(payload) {
  const r = await fetch(`${SITE}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': KEY },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || r.status);
  return d;
}

const SQ = 1600;
async function squarePadWhite(buf) {
  const m = await sharp(buf).metadata();
  const s = Math.max(m.width, m.height);
  return sharp(buf).extend({
    top: Math.floor((s - m.height) / 2), bottom: Math.ceil((s - m.height) / 2),
    left: Math.floor((s - m.width) / 2), right: Math.ceil((s - m.width) / 2),
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
}

console.log('1. upsert draft product…');
await api({ action: 'save', product: { id: ID, name: 'MCP Self Test', collection: 'Hot-Serve', desc: 'temp', status: 'draft', image: '' } });
console.log('   ok');

console.log('2. square-pad photo upload…');
const raw = await readFile(IMG);
const normalized = await sharp(raw).rotate().resize({ width: SQ, height: SQ, fit: 'inside' }).toBuffer();
const sq = await squarePadWhite(normalized);
const up1 = await api({ action: 'upload-image', name: ID + '.jpg', dataBase64: sq.toString('base64') });
console.log('   ok →', up1.path, Math.round(sq.length / 1024) + 'KB');

console.log('3. AI white-studio (model pehli baar download hota hai)…');
const t0 = Date.now();
const { removeBackground } = await import('@imgly/background-removal-node');
const cutBlob = await removeBackground(new Blob([await sharp(normalized).png().toBuffer()], { type: 'image/png' }));
const cut = Buffer.from(await cutBlob.arrayBuffer());
const subject = await sharp(cut).trim().toBuffer();
const fit = Math.round(SQ * 0.86);
const resized = await sharp(subject).resize({ width: fit, height: fit, fit: 'inside' }).toBuffer();
const m2 = await sharp(resized).metadata();
const studio = await sharp(resized).extend({
  top: Math.floor((SQ - m2.height) / 2), bottom: Math.ceil((SQ - m2.height) / 2),
  left: Math.floor((SQ - m2.width) / 2), right: Math.ceil((SQ - m2.width) / 2),
  background: { r: 255, g: 255, b: 255, alpha: 1 },
}).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
const meta = await sharp(studio).metadata();
const corner = await sharp(studio).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
console.log('   ok —', meta.width + 'x' + meta.height, '| corner rgb:', [...corner].join(','), '|', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const up2 = await api({ action: 'upload-image', name: ID + '-studio.jpg', dataBase64: studio.toString('base64') });
console.log('   uploaded →', up2.path, Math.round(studio.length / 1024) + 'KB');

console.log('4. attach gallery + verify…');
const p = (await api({ action: 'list' })).products.find(x => x.id === ID);
await api({ action: 'save', product: { ...p, images: [up2.path, up1.path], image: up2.path } });
const p2 = (await api({ action: 'list' })).products.find(x => x.id === ID);
console.log('   gallery:', p2.images.length, '| status:', p2.status);

console.log('5. cleanup — delete test product…');
await api({ action: 'delete', id: ID });
console.log('   done. SELF-TEST PASS ✓');

/* ============================================================
   XANVOR listing-image renderers (server-side, sharp + SVG).
   Mirrors the browser Listing Studio templates so the MCP can
   produce Amazon-style images headlessly:
     - whiteMain  : 1:1 white-studio hero (AI bg-removal, fallback square)
     - callouts   : white hero + feature labels (auto-placed or given anchors)
     - collage    : 2–4 photos in a grid + product name
     - hero       : photo left + name & bulleted features right
   All output 1600×1600 JPEG with a XANVOR footer.
   Fonts: system sans (brand fonts live in the browser studio); fine for
   secondary marketplace images.
   ============================================================ */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const SQ = 1600;
const INK = '#241510', RUST = '#A85D2A', BONE = '#FBF6E8', LINE = '#E6DCC8';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let _rb = null;
const getRB = async () => _rb || (_rb = (await import('@imgly/background-removal-node')).removeBackground);

const footerSvg = () =>
  `<text x="${SQ / 2}" y="${SQ - 34}" text-anchor="middle" font-family="monospace" font-size="24" letter-spacing="6" fill="${RUST}">XANVOR · MORADABAD · IN</text>`;

async function normalize(filePath) {
  const buf = await readFile(filePath);
  return sharp(buf).rotate().resize({ width: SQ, height: SQ, fit: 'inside', withoutEnlargement: true }).toBuffer();
}

/* white 1:1 hero + the product's placement rect on the canvas (for callout anchoring) */
export async function whiteMain(filePath, { whiteBg = true, margin = 0.07 } = {}) {
  const norm = await normalize(filePath);
  let subject, usedAI = false;
  if (whiteBg) {
    try {
      const rb = await getRB();
      const cutBlob = await rb(new Blob([await sharp(norm).png().toBuffer()], { type: 'image/png' }));
      subject = await sharp(Buffer.from(await cutBlob.arrayBuffer())).trim().toBuffer();
      usedAI = true;
    } catch { subject = norm; }
  } else {
    subject = await sharp(norm).trim().toBuffer();
  }
  const fit = Math.round(SQ * (1 - 2 * margin));
  const resized = await sharp(subject).resize({ width: fit, height: fit, fit: 'inside' }).toBuffer();
  const m = await sharp(resized).metadata();
  const x = Math.floor((SQ - m.width) / 2), y = Math.floor((SQ - m.height) / 2);
  const buf = await sharp({ create: { width: SQ, height: SQ, channels: 4, background: '#ffffff' } })
    .composite([{ input: resized, left: x, top: y }])
    .flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  return { buf, usedAI, prod: { x, y, w: m.width, h: m.height } };
}

function calloutSvg(prod, labels) {
  /* assign anchors: use given {x,y} else auto on the product rect edges, alternating L/R */
  const items = labels.map((l, i) => {
    if (typeof l.x === 'number' && typeof l.y === 'number') return { text: l.text, ax: l.x, ay: l.y };
    const left = i % 2 === 0;
    const n = labels.length;
    const ay = prod.y + prod.h * ((i + 1) / (n + 1));
    const ax = left ? prod.x + prod.w * 0.18 : prod.x + prod.w * 0.82;
    return { text: l.text, ax, ay };
  });
  const sides = { left: [], right: [] };
  items.forEach(c => sides[c.ax < SQ / 2 ? 'left' : 'right'].push(c));
  let defs = '', svg = '';
  const FS = 28, lh = 60, PC = 19, MAXW = SQ - 56;
  let k = 0;
  for (const side of ['left', 'right']) {
    let lastY = 0;
    sides[side].sort((a, b) => a.ay - b.ay).forEach(c => {
      let ly = Math.max(110, Math.min(SQ - 150, c.ay));
      if (ly < lastY + 96) ly = lastY + 96;
      lastY = ly;
      const label = c.text.toUpperCase().slice(0, 30);
      const chipW = Math.min(label.length * PC + 40, MAXW);
      let chipX = side === 'left' ? 28 : SQ - 28 - chipW;
      chipX = Math.max(20, Math.min(chipX, SQ - 20 - chipW));
      const lineStart = side === 'left' ? chipX + chipW : chipX;
      const cid = `cl${k++}`;
      defs += `<clipPath id="${cid}"><rect x="${chipX}" y="${ly - 30}" width="${chipW}" height="${lh}" rx="10"/></clipPath>`;
      svg += `<line x1="${lineStart}" y1="${ly}" x2="${c.ax}" y2="${c.ay}" stroke="${INK}" stroke-width="3"/>`;
      svg += `<circle cx="${c.ax}" cy="${c.ay}" r="13" fill="${RUST}" stroke="#fff" stroke-width="4"/>`;
      svg += `<rect x="${chipX}" y="${ly - 30}" width="${chipW}" height="${lh}" rx="10" fill="${INK}"/>`;
      svg += `<text clip-path="url(#${cid})" x="${chipX + 20}" y="${ly + 9}" font-family="sans-serif" font-size="${FS}" font-weight="bold" fill="${BONE}">${esc(label)}</text>`;
    });
  }
  return `<defs>${defs}</defs>${svg}`;
}

export async function renderCallouts(mainBuf, prod, labels) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SQ}" height="${SQ}">${calloutSvg(prod, labels)}${footerSvg()}</svg>`;
  return sharp(mainBuf).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

export async function renderCollage(buffers, name) {
  const G = 18, top = 24, bottom = SQ - 110, areaX = 24, areaW = SQ - 48, areaH = bottom - top;
  const n = Math.min(buffers.length, 4);
  const cells = [];
  if (n === 1) cells.push([areaX, top, areaW, areaH]);
  else if (n === 2) { const w = (areaW - G) / 2; cells.push([areaX, top, w, areaH], [areaX + w + G, top, w, areaH]); }
  else if (n === 3) { const w = (areaW - G) * 0.58, w2 = areaW - G - w, h2 = (areaH - G) / 2; cells.push([areaX, top, w, areaH], [areaX + w + G, top, w2, h2], [areaX + w + G, top + h2 + G, w2, h2]); }
  else { const w = (areaW - G) / 2, h = (areaH - G) / 2; cells.push([areaX, top, w, h], [areaX + w + G, top, w, h], [areaX, top + h + G, w, h], [areaX + w + G, top + h + G, w, h]); }
  const layers = [];
  for (let i = 0; i < n; i++) {
    const [cx, cy, cw, ch] = cells[i];
    const pad = 0.04, iw = Math.round(cw * (1 - 2 * pad)), ih = Math.round(ch * (1 - 2 * pad));
    const fitted = await sharp(buffers[i]).resize({ width: iw, height: ih, fit: 'inside', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
    const fm = await sharp(fitted).metadata();
    layers.push({ input: fitted, left: Math.round(cx + (cw - fm.width) / 2), top: Math.round(cy + (ch - fm.height) / 2) });
  }
  const nameSvg = name ? `<text x="${SQ / 2}" y="${SQ - 70}" text-anchor="middle" font-family="serif" font-size="44" fill="${INK}">${esc(name)}</text>` : '';
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${SQ}" height="${SQ}">${nameSvg}${footerSvg()}</svg>`;
  layers.push({ input: Buffer.from(overlay), top: 0, left: 0 });
  return sharp({ create: { width: SQ, height: SQ, channels: 4, background: '#ffffff' } })
    .composite(layers).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
}

export async function renderHero(filePathOrBuf, name, features) {
  const src = Buffer.isBuffer(filePathOrBuf) ? filePathOrBuf : (await whiteMain(filePathOrBuf)).buf;
  const photo = await sharp(src).resize({ width: 880, height: 1100, fit: 'inside', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
  const pm = await sharp(photo).metadata();
  /* wrap the name to <=2 lines so it never overflows the right panel (x 950..1560) */
  const words = String(name || 'XANVOR').split(/\s+/);
  const FS = 58, PERLINE = 15, MAXLINES = 3;
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > PERLINE && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (lines.length === MAXLINES) { cur = ''; break; }
  }
  if (cur && lines.length < MAXLINES) lines.push(cur);
  let ty = lines.length > 1 ? 280 : 320;
  let txt = lines.map((ln, i) => `<text x="950" y="${ty + i * (FS + 8)}" font-family="serif" font-size="${FS}" fill="${INK}">${esc(ln)}</text>`).join('');
  ty += (lines.length - 1) * (FS + 8) + 30;
  txt += `<rect x="950" y="${ty}" width="120" height="4" fill="${RUST}"/>`; ty += 66;
  (features || []).slice(0, 5).forEach(f => {
    txt += `<circle cx="962" cy="${ty - 12}" r="9" fill="${RUST}"/>`;
    txt += `<text x="990" y="${ty}" font-family="sans-serif" font-size="40" fill="#1F140C">${esc(f.slice(0, 40))}</text>`;
    ty += 64;
  });
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${SQ}" height="${SQ}">${txt}${footerSvg()}</svg>`;
  return sharp({ create: { width: SQ, height: SQ, channels: 4, background: '#ffffff' } })
    .composite([{ input: photo, left: 10, top: Math.round((SQ - pm.height) / 2) }, { input: Buffer.from(overlay), top: 0, left: 0 }])
    .flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
}

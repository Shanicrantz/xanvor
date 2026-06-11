/* ============================================================
   XANVOR SEO builder — generates sitemap.xml + merchant-feed.xml
   from assets/products.js. Run after any product change:

     node tools/build-seo.mjs

   Commit the regenerated XML files along with products.js.
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://xanvor.com';

/* ---- load the catalogue exactly as the browser sees it ---- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(ROOT, 'assets/products.js'), 'utf8'), sandbox);
const PRODUCTS = sandbox.window.XANVOR_PRODUCTS || [];
if (!PRODUCTS.length) throw new Error('No products found in assets/products.js');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const productURL = (p) => `${SITE}/product.html?id=${encodeURIComponent(p.id)}`;
const imageURL   = (p) => `${SITE}/${String(p.image || '').replace(/^\/+/, '')}`;
const today      = new Date().toISOString().slice(0, 10);

/* ============================================================
   1 · sitemap.xml — every indexable page
   ============================================================ */
const staticPages = [
  { loc: `${SITE}/`,                              priority: '1.0' },
  { loc: `${SITE}/Hot-Serve%20Collection.html`,   priority: '0.8' },
  { loc: `${SITE}/privacy-policy.html`,           priority: '0.3' },
  { loc: `${SITE}/refund-policy.html`,            priority: '0.3' },
  { loc: `${SITE}/shipping-policy.html`,          priority: '0.3' },
  { loc: `${SITE}/terms.html`,                    priority: '0.3' },
];
const urlEntries = [
  ...staticPages.map(p => ({ ...p })),
  ...PRODUCTS.map(p => ({ loc: esc(productURL(p)), priority: '0.7' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);
console.log(`sitemap.xml — ${urlEntries.length} URLs`);

/* ============================================================
   2 · merchant-feed.xml — Google Merchant Center (RSS 2.0)
   Only retail-priced pieces qualify (price is mandatory).
   Prices are GST-INCLUSIVE — Google requires this for India,
   and they must match the price shown on the landing page.
   ============================================================ */
const retail = PRODUCTS.filter(p => typeof (p.retail || p.offer) === 'number' && p.mrp);

const items = retail.map(p => {
  const rate  = (parseFloat(p.gst) || 18) / 100;       // per-product GST
  const base  = p.retail || p.offer;
  const incl  = Math.round(base * (1 + rate));         // matches PDP buybox + checkout total
  const firstMaterial = String(p.materials || '').split('·')[0].trim();
  const title = `${p.name} — ${firstMaterial} · XANVOR`;
  const description = [
    p.desc,
    (p.highlights || []).join('. '),
    p.sizes ? `Sizes: ${p.sizes}.` : '',
    'Hand-hammered in Moradabad, India.',
  ].filter(Boolean).join(' ').replace(/\.\./g, '.');
  return `  <item>
    <g:id>${esc(p.id)}</g:id>
    <g:title>${esc(title)}</g:title>
    <g:description>${esc(description)}</g:description>
    <g:link>${esc(productURL(p))}</g:link>
    <g:image_link>${esc(imageURL(p))}</g:image_link>
    <g:availability>in_stock</g:availability>
    <g:condition>new</g:condition>
    <g:brand>XANVOR</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:price>${p.mrp}.00 INR</g:price>
    <g:sale_price>${incl}.00 INR</g:sale_price>
    <g:google_product_category>Home &amp; Garden &gt; Kitchen &amp; Dining &gt; Tableware &gt; Serveware</g:google_product_category>
    <g:product_type>${esc(`XANVOR > ${p.collection}`)}</g:product_type>
    <g:shipping>
      <g:country>IN</g:country>
      <g:service>Standard</g:service>
      <g:price>0.00 INR</g:price>
    </g:shipping>
  </item>`;
});

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>XANVOR — Hand-Hammered Brass &amp; Metal Homeware</title>
  <link>${SITE}</link>
  <description>Hand-finished metal homeware from Moradabad, India. Food warmers, hot-pots and serving domes in solid brass and steel. A house brand of Zenko Inc.</description>
${items.join('\n')}
</channel>
</rss>
`;
writeFileSync(join(ROOT, 'merchant-feed.xml'), feed);
console.log(`merchant-feed.xml — ${retail.length} retail products`);
retail.forEach(p => {
  const rate = (parseFloat(p.gst) || 18) / 100;
  const incl = Math.round((p.retail || p.offer) * (1 + rate));
  console.log(`  ${p.id}  MRP ₹${p.mrp}  sale ₹${incl} (incl. ${p.gst || '18%'} GST)`);
});

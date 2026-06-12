/* ============================================================
   Pure render helpers — products array in, text out.
   Shared by the products.js / sitemap.xml / merchant-feed.xml
   functions so all three always agree with each other.
   ============================================================ */

const SITE = 'https://xanvor.com';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const productURL = (p) => `${SITE}/product.html?id=${encodeURIComponent(p.id)}`;

const absImage = (s) => {
  const img = String(s || '');
  return img.startsWith('/') ? `${SITE}${img}` : `${SITE}/${img}`;
};
export const imageURL = (p) => absImage(p.image);
/* full gallery — images[] if present, else the single image */
export const galleryOf = (p) =>
  (Array.isArray(p.images) && p.images.length ? p.images : [p.image]).filter(Boolean);

/* GST-inclusive customer price — must match product.js buybox math */
export const inclPrice = (p) => {
  const rate = (parseFloat(p.gst) || 18) / 100;
  const base = p.retail || p.offer;
  return Math.round(base * (1 + rate));
};

export const isRetail = (p) => typeof (p.retail || p.offer) === 'number' && !!p.mrp;

/* drafts live in the admin catalogue but never reach the public site/Google */
export const liveOnly = (products) => products.filter(p => p.status !== 'draft');

/* ---- /api/products.js — drop-in replacement for assets/products.js ---- */
export function renderProductsJs(products) {
  return '// XANVOR product catalogue — served live from the admin catalogue\n'
    + 'window.XANVOR_PRODUCTS = ' + JSON.stringify(products, null, 1) + ';\n';
}

/* ---- /sitemap.xml ---- */
export function renderSitemap(products, lastmod) {
  const staticPages = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/Hot-Serve%20Collection.html`, priority: '0.8' },
    { loc: `${SITE}/privacy-policy.html`, priority: '0.3' },
    { loc: `${SITE}/refund-policy.html`, priority: '0.3' },
    { loc: `${SITE}/shipping-policy.html`, priority: '0.3' },
    { loc: `${SITE}/terms.html`, priority: '0.3' },
  ];
  const urls = [
    ...staticPages,
    ...products.map(p => ({ loc: esc(productURL(p)), priority: '0.7' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

/* ---- /merchant-feed.xml — Google Shopping (India: GST-inclusive prices) ---- */
export function renderFeed(products) {
  const retail = products.filter(isRetail);
  const items = retail.map(p => {
    const incl = inclPrice(p);
    const gal = galleryOf(p);
    const extraImgs = gal.slice(1, 11).map(g =>
      `\n    <g:additional_image_link>${esc(absImage(g))}</g:additional_image_link>`).join('');
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
    <g:image_link>${esc(absImage(gal[0]))}</g:image_link>${extraImgs}
    <g:availability>${p.availability === 'out_of_stock' ? 'out_of_stock' : 'in_stock'}</g:availability>
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>XANVOR — Hand-Hammered Brass &amp; Metal Homeware</title>
  <link>${SITE}</link>
  <description>Hand-finished metal homeware from Moradabad, India. Food warmers, hot-pots and serving domes in solid brass and steel. A house brand of Zenko Inc.</description>
${items.join('\n')}
</channel>
</rss>
`;
}

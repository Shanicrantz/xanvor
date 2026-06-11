# XANVOR — Google SEO, Merchant Center & catalogue admin

## How products work (live catalogue — no deploys)

The catalogue lives in **Netlify Blobs**, managed from **`https://xanvor.com/admin.html`**
(password = `XANVOR_ADMIN_KEY` environment variable in Netlify). Functions serve everything
live from it:

| URL | Function | Purpose |
|---|---|---|
| `/api/products.js` | `products-js.mjs` | Live catalogue script — pages load this instead of `assets/products.js` |
| `/sitemap.xml` | `sitemap.mjs` | Always-fresh sitemap (static pages + every product) |
| `/merchant-feed.xml` | `feed.mjs` | Google Shopping feed — retail products, GST-inclusive prices |
| `/api/admin` | `admin-api.mjs` | Admin API (list/save/delete/upload-image), `x-admin-key` auth |
| `/img/<name>` | `img.mjs` | Admin-uploaded product photos (Netlify Blobs) |

**Adding a product = open `/admin.html`, fill the form, Save.** Website shows it in ~1 minute
(60s cache), sitemap/feed update instantly, Google picks it up on its next daily fetch.
No deploy, no script, no git.

Notes:
- `assets/products.js` stays in the repo only as the **seed** — first admin save makes the
  blob catalogue the source of truth. (Seed snapshot: `netlify/functions/data/products-seed.mjs`.)
- Old product photos stay at `assets/products/`; new uploads go to `/img/…` blobs. Both work.
- Only products with **MRP + retail/offer** enter the merchant feed (Google needs a price).
- Prices in feed/PDP/JSON-LD are **GST-inclusive** (India policy) and use each product's own
  `gst` field. "Out of stock" in admin → `out_of_stock` in the feed.
- Deploys are only needed for design/code changes now.

## One-time Google setup (done 2026-06-12)

1. **Search Console**: domain property `xanvor.com`, verified via Cloudflare DNS TXT.
   Sitemap submitted: `https://xanvor.com/sitemap.xml`.
2. **Merchant Center**: account XANVOR (India, INR), website claimed via the same Google
   account, primary feed = scheduled daily fetch of `https://xanvor.com/merchant-feed.xml`.
3. Merchant Center settings: free shipping India (5–10 business days), returns →
   `https://xanvor.com/refund-policy.html`, contact info matching the site.

## Admin key

- Stored as Netlify env var `XANVOR_ADMIN_KEY` (Site configuration → Environment variables).
- To rotate: change the env var. Functions read it at runtime — takes effect immediately
  (no redeploy needed for env var changes on functions? Netlify requires redeploy for env
  changes — do a quick "Trigger deploy" from the dashboard after rotating).

## Checklist if products stop showing in Google

- `https://xanvor.com/merchant-feed.xml` opens and is valid XML
- Merchant Center → Products → Diagnostics for per-item errors
- PDP price (incl. GST) must equal feed `sale_price`
- Search Console → Sitemaps shows Success

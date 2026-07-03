/* ============================================================
   Catalogue store — Netlify Blobs with a baked-in seed fallback.
   The blob becomes the source of truth after the first admin save;
   until then the seed (snapshot of assets/products.js) serves.
   ============================================================ */
import { getStore } from '@netlify/blobs';
import seed from '../data/products-seed.mjs';

const STORE = 'xanvor-catalog';
const KEY = 'catalog';

/* strong consistency: admin read-modify-write must never see stale data,
   else a quick second save could clobber the first. Public endpoints are
   CDN-cached anyway, so the small latency cost lands ~once a minute. */
const store = () => getStore({ name: STORE, consistency: 'strong' });

export async function getCatalog() {
  try {
    const data = await store().get(KEY, { type: 'json' });
    if (data && Array.isArray(data.products) && data.products.length) {
      return {
        updated_at: data.updated_at,
        products: data.products,
        collection_order: Array.isArray(data.collection_order) ? data.collection_order : [],
      };
    }
  } catch (e) { /* fall through to seed */ }
  return { updated_at: null, products: seed, collection_order: [] };
}

export async function saveCatalog(products, collectionOrder = []) {
  const data = { updated_at: new Date().toISOString(), products, collection_order: collectionOrder };
  await store().setJSON(KEY, data);
  return data;
}

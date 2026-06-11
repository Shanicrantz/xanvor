/* ============================================================
   Catalogue store — Netlify Blobs with a baked-in seed fallback.
   The blob becomes the source of truth after the first admin save;
   until then the seed (snapshot of assets/products.js) serves.
   ============================================================ */
import { getStore } from '@netlify/blobs';
import seed from '../data/products-seed.mjs';

const STORE = 'xanvor-catalog';
const KEY = 'catalog';

export async function getCatalog() {
  try {
    const store = getStore(STORE);
    const data = await store.get(KEY, { type: 'json' });
    if (data && Array.isArray(data.products) && data.products.length) return data;
  } catch (e) { /* fall through to seed */ }
  return { updated_at: null, products: seed };
}

export async function saveCatalog(products) {
  const store = getStore(STORE);
  const data = { updated_at: new Date().toISOString(), products };
  await store.setJSON(KEY, data);
  return data;
}

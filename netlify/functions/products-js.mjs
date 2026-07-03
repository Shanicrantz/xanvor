/* /api/products.js — live catalogue as a script, drop-in for assets/products.js */
import { getCatalog } from './lib/catalog.mjs';
import { renderProductsJs, liveOnly } from './lib/render.mjs';

export default async () => {
  const { products, collection_order } = await getCatalog();
  return new Response(renderProductsJs(liveOnly(products), collection_order), {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=60, must-revalidate',
    },
  });
};

export const config = { path: '/api/products.js' };

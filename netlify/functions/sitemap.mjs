/* /sitemap.xml — always fresh, generated from the live catalogue */
import { getCatalog } from './lib/catalog.mjs';
import { renderSitemap } from './lib/render.mjs';

export default async () => {
  const { products, updated_at } = await getCatalog();
  const lastmod = (updated_at || new Date().toISOString()).slice(0, 10);
  return new Response(renderSitemap(products, lastmod), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
};

export const config = { path: '/sitemap.xml' };

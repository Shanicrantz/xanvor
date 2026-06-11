/* /merchant-feed.xml — Google Merchant Center feed from the live catalogue */
import { getCatalog } from './lib/catalog.mjs';
import { renderFeed } from './lib/render.mjs';

export default async () => {
  const { products } = await getCatalog();
  return new Response(renderFeed(products), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
};

export const config = { path: '/merchant-feed.xml' };

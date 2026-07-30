/* /pinterest-feed.xml — Pinterest catalog data source from the live catalogue.
   Connect in Pinterest: Business Hub → Catalogs → add a data source and point
   it at https://xanvor.com/pinterest-feed.xml (daily fetch). The domain is
   already claimed, which Pinterest requires before a catalog will ingest. */
import { getCatalog } from './lib/catalog.mjs';
import { renderPinterestFeed, liveOnly } from './lib/render.mjs';

export default async () => {
  const { products } = await getCatalog();
  return new Response(renderPinterestFeed(liveOnly(products)), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
};

export const config = { path: '/pinterest-feed.xml' };

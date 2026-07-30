/* /api/fx — reference FX rates for the display-currency switcher.
   Read-only, public, cached at the edge. Returns the stored rate set with
   its timestamp so the client can label a stale rate honestly instead of
   showing a confident-looking number that is weeks old. */
import { getStoredRates } from './lib/fx.mjs';

export default async () => {
  const data = await getStoredRates();
  const ageMs = Date.now() - Date.parse(data.at || 0);
  const stale = !(ageMs >= 0) || ageMs > 48 * 3600 * 1000;
  return new Response(JSON.stringify({ ...data, stale }), {
    headers: {
      'content-type': 'application/json',
      /* browsers re-check hourly; the edge serves for 12h and can keep
         serving a stale copy for a week while it revalidates behind us */
      'cache-control': 'public, max-age=3600',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=43200, stale-while-revalidate=604800',
    },
  });
};

export const config = { path: '/api/fx' };

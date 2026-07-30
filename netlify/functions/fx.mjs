/* /api/fx — reference FX rates for the display-currency switcher.
   Read-only, public, cached at the edge. Returns the stored rate set with
   its timestamp so the client can label a stale rate honestly instead of
   showing a confident-looking number that is weeks old. */
import { getStoredRates, refreshRates } from './lib/fx.mjs';

const STALE_MS = 48 * 3600 * 1000;

export default async () => {
  let data = await getStoredRates();
  let ageMs = Date.now() - Date.parse(data.at || 0);

  /* Self-heal: a brand-new deploy has an empty store, and the daily cron
     could silently fail. Rather than serve the baked table forever, refresh
     inline when what we have is unusable. Only ever on the rare miss — the
     edge caches this for 12h, so it is a couple of slow requests a day, and
     a failed refresh just keeps whatever we already had. */
  if (data.source === 'fallback' || !(ageMs >= 0) || ageMs > STALE_MS) {
    try {
      data = await refreshRates();
      ageMs = 0;
    } catch (e) {
      console.error('fx: inline refresh failed, serving stored/fallback —', e.message);
    }
  }

  const stale = !(ageMs >= 0) || ageMs > STALE_MS;
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

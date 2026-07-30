/* Daily FX refresh. Pulls fresh reference rates into the xanvor-fx blob so
   /api/fx can serve them without a live upstream call on the request path.
   Never throws — a failed run just leaves yesterday's rates in place, and
   /api/fx marks anything older than 48h as stale for the UI to warn about. */
import { refreshRates } from './lib/fx.mjs';

export default async () => {
  try {
    const fresh = await refreshRates();
    console.log(JSON.stringify({ fxCron: 'ok', source: fresh.source, at: fresh.at, usd: fresh.rates.USD }));
    return new Response('ok');
  } catch (e) {
    console.log(JSON.stringify({ fxCron: 'error', error: e.message || String(e) }));
    return new Response('error logged');
  }
};

/* schedule only — a scheduled function must NOT also declare a path */
export const config = { schedule: '@daily' };

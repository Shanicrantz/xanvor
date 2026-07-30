/* /api/geo — visitor country only, from Netlify's edge.
   Used to OFFER a currency (never to switch silently) and to show the
   "this checkout is India-only" notice to buyers outside India.
   Deliberately country-only: analytics.mjs stores no IP and neither
   should this. No caching — the answer differs per visitor. */
import { geoFromContext } from './lib/analytics.mjs';

export default async (req, context) => {
  let country = '';
  try { country = (geoFromContext(context) || {}).country || ''; } catch { /* unknown */ }
  return new Response(JSON.stringify({ country }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};

export const config = { path: '/api/geo' };

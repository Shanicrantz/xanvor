/* /api/track — first-party visitor tracking beacon.
   Called by assets/visit.js on page view, on a 60s heartbeat (so the admin
   can show "on site now") and on named events (add-to-cart, checkout, …).
   Accepts sendBeacon bodies (text/plain) as well as normal JSON fetches.
   Always answers 204 quickly — tracking must never slow a page down. */
import { recordHit, deviceFromUA, geoFromContext } from './lib/analytics.mjs';

const noContent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  let body;
  try {
    const raw = await req.text();
    body = JSON.parse(raw || '{}');
  } catch { return noContent(); }

  try {
    const { device, browser } = deviceFromUA(req.headers.get('user-agent') || '');
    await recordHit({
      sid: body.sid,
      vid: body.vid,
      kind: body.kind === 'ping' ? 'ping' : body.kind === 'event' ? 'event' : 'view',
      path: body.path,
      title: body.title,
      ref: body.ref,
      utm: body.utm,
      visits: body.visits,
      event: body.event,
      meta: body.meta,
      identity: body.identity,
      device,
      browser,
      geo: geoFromContext(context),
    });
  } catch { /* bad payload / blob hiccup — never surface to the visitor */ }

  return noContent();
};

export const config = { path: '/api/track' };

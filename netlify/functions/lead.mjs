/* /api/lead — offer-popup capture (email and/or phone).
   Saves/updates the lead, attaches the identity to the visitor session so
   the admin's Visitors list stops being anonymous, and pings the shop once
   per new lead. Returns the coupon code the popup promised. */
import { saveLead, recordHit, geoFromContext } from './lib/analytics.mjs';
import { sendLeadAlert } from './lib/notify.mjs';

const OFFER_CODE = 'WELCOME200';
const OFFER_TEXT = '₹200 off your first order (min ₹1,499)';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  try {
    const { record, isNew } = await saveLead({
      email: body.email,
      phone: body.phone,
      name: body.name,
      source: body.source || 'offer-popup',
      coupon: OFFER_CODE,
      sid: body.sid,
      pages: body.pages,
      geo: geoFromContext(context),
    });

    /* tie the lead to the live session (best-effort — never fail the capture) */
    if (body.sid) {
      try {
        await recordHit({
          sid: body.sid, kind: 'event', event: 'lead',
          meta: { coupon: OFFER_CODE },
          identity: { email: record.email, phone: record.phone, name: record.name },
          geo: geoFromContext(context),
        });
      } catch { /* ignore */ }
    }

    await sendLeadAlert(record, isNew);
    return json({ ok: true, coupon: OFFER_CODE, offer: OFFER_TEXT });
  } catch (e) {
    return json({ ok: false, error: e.message || 'save failed' }, 400);
  }
};

export const config = { path: '/api/lead' };

/* /api/rfq — request-for-quotation intake (RFQ basket checkout + the
   standalone wholesale form). Persists the RFQ with a quotable reference
   number, ties it to the visitor session, emails the shop and sends the
   buyer an acknowledgment. Mirrors orders-create.mjs conventions. */
import { createRfq, newRid } from './lib/rfqs.mjs';
import { sendOwnerRfqAlert, sendRfqAckEmail } from './lib/notify.mjs';
import { recordHit, geoFromContext } from './lib/analytics.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INCOTERMS = ['EXW Moradabad', 'FOB Nhava Sheva / Mundra', 'CIF (destination port)', 'DDP (door delivery)', 'Need advice'];
/* Currency the buyer would like the quotation/Proforma Invoice issued in.
   USD is the standard and the fallback for anything unrecognised.
   Keep in sync with QUOTE_CCY in enquiry-basket.js and wholesale.html. */
const QUOTE_CCY = ['USD', 'EUR', 'GBP', 'AED', 'INR'];

function cleanRfq(raw) {
  const name = str(raw.name, 120);
  const email = str(raw.email, 200).toLowerCase();
  if (!name) throw new Error('Name required');
  if (!EMAIL_RE.test(email)) throw new Error('Valid email required');

  const incoterm = INCOTERMS.includes(str(raw.incoterm, 60)) ? str(raw.incoterm, 60) : 'Need advice';
  const rawCcy = str(raw.currency, 8).toUpperCase();
  const currency = QUOTE_CCY.includes(rawCcy) ? rawCcy : 'USD';
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  /* reject rather than silently truncate — a 70-line basket that quietly
     becomes 60 lines loses order lines nobody ever finds out about */
  if (rawItems.length > 60) throw new Error('Too many lines — please split the request into two RFQs of up to 60 lines each');
  const items = rawItems.map((it) => ({
    code: str(it.code, 40),
    name: str(it.name, 160),
    qty: Math.max(1, Math.min(1000000, parseInt(it.qty, 10) || 1)),
    finish: str(it.finish, 60),
    image: str(it.image, 300),
  })).filter((it) => it.name || it.code);

  return {
    name,
    email,
    company: str(raw.company, 160),
    phone: str(raw.phone, 40),
    country: str(raw.country, 80),
    port: str(raw.port, 120),
    incoterm,
    currency,
    shipdate: str(raw.shipdate, 120),
    message: str(raw.message, 3000),
    source: ['basket', 'form'].includes(raw.source) ? raw.source : 'form',
    items,
  };
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (body['bot-field']) return json({ ok: true, rid: 'XV-RFQ-OK' }); // honeypot: pretend success

  try {
    const clean = cleanRfq(body);
    clean.rid = await newRid();
    clean.geo = geoFromContext(context);
    const saved = await createRfq(clean);

    /* tie to the live visitor session (best-effort — never fail the RFQ) */
    if (body.sid) {
      try {
        await recordHit({
          sid: str(body.sid, 64), kind: 'event', event: 'rfq',
          meta: { rid: saved.rid, lines: saved.items.length },
          identity: { email: saved.email, phone: saved.phone, name: saved.name },
          geo: geoFromContext(context),
        });
      } catch { /* ignore */ }
    }

    /* awaited on purpose: a serverless function can be frozen the instant
       it returns — un-awaited sends can silently never complete. Both
       senders swallow their own errors, so this cannot fail the request. */
    await sendOwnerRfqAlert(saved);
    await sendRfqAckEmail(saved);

    return json({ ok: true, rid: saved.rid });
  } catch (e) {
    return json({ ok: false, error: e.message || 'save failed' }, 400);
  }
};

export const config = { path: '/api/rfq' };

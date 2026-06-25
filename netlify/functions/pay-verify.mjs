/* /api/pay/verify — verifies a Razorpay payment signature server-side.
   Returns { ok: true } only if the signature is authentic, so a faked
   browser success can't mark an order paid. */

import crypto from 'node:crypto';

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!KEY_SECRET) return json({ ok: false, error: 'payments_not_configured' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = b || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }

  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(razorpay_signature, 'hex'));
  } catch { ok = false; }

  return json({ ok, paymentId: ok ? razorpay_payment_id : undefined });
};

export const config = { path: '/api/pay/verify' };

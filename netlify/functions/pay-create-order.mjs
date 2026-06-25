/* /api/pay/create-order — creates a Razorpay order.
   Keys come from Netlify env vars (test or live — whichever is set):
     RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
   The secret never reaches the browser. The client gets back the order id +
   the public key id, which is all Razorpay Checkout needs. */

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!KEY_ID || !KEY_SECRET) return json({ error: 'payments_not_configured' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const amount = Math.round(Number(body.amount) * 100); // INR rupees -> paise
  if (!Number.isFinite(amount) || amount < 100) return json({ error: 'bad_amount' }, 400);
  const receipt = String(body.receipt || ('XV' + Date.now())).slice(0, 40);

  const auth = 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
  let data;
  try {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({ amount, currency: 'INR', receipt, payment_capture: 1 }),
    });
    data = await r.json();
    if (!r.ok) return json({ error: 'razorpay_error', detail: data?.error?.description || '' }, 502);
  } catch (e) {
    return json({ error: 'razorpay_unreachable' }, 502);
  }

  return json({ orderId: data.id, amount: data.amount, currency: data.currency, keyId: KEY_ID });
};

export const config = { path: '/api/pay/create-order' };

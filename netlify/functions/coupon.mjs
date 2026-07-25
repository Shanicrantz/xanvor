/* /api/coupon — validates a discount code against the cart subtotal.
   Rules live in lib/coupon.mjs so orders-create applies exactly the same
   maths when it persists the order. Always answers 200; the `ok` flag
   carries the verdict so the checkout can show a friendly message. */
import { validateCoupon } from './lib/coupon.mjs';

const json = (obj) => new Response(JSON.stringify(obj), {
  status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export default async (req) => {
  let code, subtotal;
  if (req.method === 'POST') {
    try { const b = await req.json(); code = b.code; subtotal = b.subtotal; }
    catch { return json({ ok: false, error: 'Invalid JSON' }); }
  } else {
    const u = new URL(req.url);
    code = u.searchParams.get('code');
    subtotal = u.searchParams.get('subtotal');
  }
  return json(validateCoupon(code, subtotal));
};

export const config = { path: '/api/coupon' };

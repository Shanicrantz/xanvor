/* /api/orders/create — POST. Persists an order once checkout has
   actually placed it (WhatsApp/COD: right before opening WhatsApp /
   showing the confirmation screen; Razorpay: only after /api/pay/verify
   has confirmed the signature). Orders link to an account purely by
   the checkout email — guest checkout stays allowed, and logging into
   that same email later shows the order (no separate merge step). */
import { createOrder } from './lib/orders.mjs';
import { sendOrderConfirmationEmail } from './lib/notify.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const PAYMENT_METHODS = ['razorpay', 'whatsapp', 'cod', 'upi', 'bank'];

function cleanOrder(raw) {
  const oid = str(raw.oid, 24);
  if (!/^[A-Z0-9]{4,24}$/.test(oid)) throw new Error('bad order id');
  const email = str(raw.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('valid email required');
  const paymentMethod = str(raw.paymentMethod, 20);
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error('bad payment method');

  const items = Array.isArray(raw.items) ? raw.items.slice(0, 50).map((it) => ({
    id: str(it.id, 40), code: str(it.code, 40), name: str(it.name, 160),
    image: str(it.image, 200), qty: Math.max(1, Math.round(num(it.qty)) || 1), price: num(it.price),
  })) : [];
  if (!items.length) throw new Error('items required');

  const t = raw.totals || {};
  const status = paymentMethod === 'razorpay' ? 'paid' : 'placed';
  if (paymentMethod === 'razorpay' && !str(raw.paymentId, 80)) throw new Error('paymentId required for razorpay orders');

  return {
    oid, email, paymentMethod, status,
    paymentId: str(raw.paymentId, 80) || undefined,
    name: str(raw.name, 120), phone: str(raw.phone, 20),
    address: str(raw.address, 240), city: str(raw.city, 80), state: str(raw.state, 80),
    pincode: str(raw.pincode, 12), landmark: str(raw.landmark, 160),
    items,
    totals: { sub: num(t.sub), gst: num(t.gst), ship: num(t.ship), total: num(t.total) },
  };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  try {
    const order = cleanOrder(body);
    const saved = await createOrder(order);
    /* awaited (not fire-and-forget): a serverless function can be frozen the
       instant it returns a response, so an un-awaited send here could just
       never complete. sendOrderConfirmationEmail never throws — the order
       stays saved either way, this only adds the Resend round-trip latency. */
    await sendOrderConfirmationEmail(saved);
    return json({ ok: true, oid: saved.oid });
  } catch (e) {
    return json({ error: e.message || 'order save failed' }, 400);
  }
};

export const config = { path: '/api/orders/create' };

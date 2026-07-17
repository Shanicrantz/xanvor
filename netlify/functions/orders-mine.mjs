/* /api/orders/mine — GET. Returns the logged-in customer's orders. */
import { getSession } from './lib/session.mjs';
import { getOrdersByEmail } from './lib/orders.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'GET only' }, 405);
  const session = getSession(req);
  if (!session) return json({ error: 'not_logged_in' }, 401);
  const orders = await getOrdersByEmail(session.email);
  return json({ orders });
};

export const config = { path: '/api/orders/mine' };

/* /api/auth/me
   GET  → { loggedIn, customer } for the current session cookie.
   POST → update profile fields (name/phone/default address); requires
          a valid session. Used by account.html's "save details" form. */
import { getSession } from './lib/session.mjs';
import { getCustomer, updateCustomer } from './lib/customers.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export default async (req) => {
  const session = getSession(req);

  if (req.method === 'GET') {
    if (!session) return json({ loggedIn: false });
    const customer = await getCustomer(session.email);
    if (!customer) return json({ loggedIn: false });
    return json({ loggedIn: true, customer });
  }

  if (req.method === 'POST') {
    if (!session) return json({ error: 'not_logged_in' }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const customer = await updateCustomer(session.email, body);
    return json({ ok: true, customer });
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config = { path: '/api/auth/me' };

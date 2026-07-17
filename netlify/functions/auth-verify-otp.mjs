/* /api/auth/verify-otp — POST {email, code}. On success, creates the
   customer record if it doesn't exist yet and sets the session cookie. */
import { verifyOtp } from './lib/otp.mjs';
import { getOrCreateCustomer } from './lib/customers.mjs';
import { setSessionCookieHeader } from './lib/session.mjs';

const json = (obj, status = 200, extraHeaders = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extraHeaders },
});

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  try {
    await verifyOtp(body.email, body.code);
    const customer = await getOrCreateCustomer(body.email);
    return json({ ok: true, customer }, 200, { 'set-cookie': setSessionCookieHeader(body.email) });
  } catch (e) {
    return json({ error: e.message || 'Verify nahi ho paya' }, 400);
  }
};

export const config = { path: '/api/auth/verify-otp' };

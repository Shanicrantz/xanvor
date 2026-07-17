/* /api/auth/logout — POST, clears the session cookie. */
import { clearSessionCookieHeader } from './lib/session.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': clearSessionCookieHeader() },
  });
};

export const config = { path: '/api/auth/logout' };

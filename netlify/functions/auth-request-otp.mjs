/* /api/auth/request-otp — POST {email}. Sends a 6-digit login code
   by email via Resend. Same response whether or not the account
   already exists (accounts are created on first verified login). */
import { requestOtp } from './lib/otp.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  try {
    await requestOtp(body.email);
    return json({ ok: true });
  } catch (e) {
    const status = e.code === 'rate_limited' ? 429 : 400;
    return json({ error: e.message || 'Code nahi bhej paye' }, status);
  }
};

export const config = { path: '/api/auth/request-otp' };

/* ============================================================
   Customer session cookie — signed, not encrypted (payload is just
   an email + timestamps, nothing secret). HMAC-SHA256 over a base64url
   JSON payload; no new dependency, no new Netlify env var required —
   the signing key derives from XANVOR_ADMIN_KEY (already set), via
   HMAC so the raw admin key never appears in any cookie or token.
   ============================================================ */
import crypto from 'node:crypto';

const COOKIE_NAME = 'xv_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function signingKey() {
  const base = process.env.XANVOR_SESSION_SECRET || process.env.XANVOR_ADMIN_KEY || '';
  if (!base) throw new Error('XANVOR_ADMIN_KEY not configured — session signing unavailable');
  return crypto.createHash('sha256').update('xv-session:' + base).digest();
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function createSessionToken(email) {
  const payload = { email: String(email).toLowerCase().trim(), iat: Date.now(), exp: Date.now() + MAX_AGE_SEC * 1000 };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac('sha256', signingKey()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const i = token.lastIndexOf('.');
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  let expected;
  try { expected = b64url(crypto.createHmac('sha256', signingKey()).update(body).digest()); }
  catch { return null; }
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(body).toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.email !== 'string' || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export function parseCookies(req) {
  const header = req.headers.get('cookie') || '';
  const out = {};
  header.split(';').forEach((part) => {
    const eq = part.indexOf('=');
    if (eq < 0) return;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function getSession(req) {
  const cookies = parseCookies(req);
  const payload = verifySessionToken(cookies[COOKIE_NAME]);
  return payload ? { email: payload.email } : null;
}

export function setSessionCookieHeader(email) {
  const token = createSessionToken(email);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SEC}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

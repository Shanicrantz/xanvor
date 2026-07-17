/* ============================================================
   Email OTP — 6-digit login code, xanvor-otp blob store keyed by
   email. Code is hashed at rest (never stored plain). Sent via
   Resend — same account/env vars already wired for trade-enquiry
   notification emails (RESEND_API_KEY, RESEND_FROM).
   ============================================================ */
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const store = () => getStore({ name: 'xanvor-otp', consistency: 'strong' });
const normEmail = (email) => String(email || '').trim().toLowerCase();
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

function genCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export async function requestOtp(email) {
  const key = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new Error('Valid email daalo');

  const existing = await store().get(key, { type: 'json' });
  if (existing && Date.now() - (existing.lastSentAt || 0) < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
    const err = new Error(`${wait}s ruko, phir dubara code bhejo`);
    err.code = 'rate_limited';
    throw err;
  }

  const code = genCode();
  await store().setJSON(key, { codeHash: hashCode(code), expiresAt: Date.now() + CODE_TTL_MS, attempts: 0, lastSentAt: Date.now() });
  await sendOtpEmail(key, code);
  return true;
}

export async function verifyOtp(email, code) {
  const key = normEmail(email);
  const record = await store().get(key, { type: 'json' });
  if (!record) { const e = new Error('Pehle code mangwao'); e.code = 'no_code'; throw e; }
  if (Date.now() > record.expiresAt) { await store().delete(key); const e = new Error('Code expire ho gaya, naya mangwao'); e.code = 'expired'; throw e; }
  if ((record.attempts || 0) >= MAX_ATTEMPTS) { await store().delete(key); const e = new Error('Bahut attempts ho gaye, naya code mangwao'); e.code = 'too_many'; throw e; }

  const given = hashCode(String(code || '').trim());
  const a = Buffer.from(given, 'hex'); const b = Buffer.from(record.codeHash, 'hex');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    await store().setJSON(key, { ...record, attempts: (record.attempts || 0) + 1 });
    const e = new Error('Galat code'); e.code = 'wrong_code'; throw e;
  }
  await store().delete(key);
  return true;
}

async function sendOtpEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'XANVOR <onboarding@resend.dev>';
  if (!apiKey) { console.error('otp.mjs: RESEND_API_KEY missing, cannot send code'); const e = new Error('Email service abhi configure nahi hai'); e.code = 'email_unconfigured'; throw e; }

  const html = `
<!doctype html><html><body style="margin:0;background:#F4EEE2;font-family:Georgia,serif;">
<div style="max-width:460px;margin:0 auto;padding:34px 28px;background:#FCFAF4;">
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A85D2A;margin-bottom:10px;">XANVOR</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:0 0 14px;font-size:22px;">Your login code</h2>
  <div style="font-family:'JetBrains Mono',monospace;font-size:34px;letter-spacing:8px;color:#A85D2A;background:#F8F2E6;border:1px dashed #D8CBB0;border-radius:8px;padding:18px;text-align:center;margin-bottom:16px;">${code}</div>
  <p style="color:#5A4636;font-size:14px;line-height:1.6;margin:0;">This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
</div>
</body></html>`.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: `${code} is your XANVOR login code`, html, text: `Your XANVOR login code: ${code}\nExpires in 5 minutes.` }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('otp.mjs: Resend rejected', res.status, t);
    const e = new Error('Code email nahi bhej paye, thodi der baad try karo'); e.code = 'send_failed'; throw e;
  }
}

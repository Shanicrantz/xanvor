/* ============================================================
   Customer accounts — Netlify Blobs, keyed by lowercased email.
   Created automatically on first verified OTP login (no separate
   signup step). Profile carries name/phone + one saved address that
   pre-fills checkout.
   ============================================================ */
import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'xanvor-customers', consistency: 'strong' });
const normEmail = (email) => String(email || '').trim().toLowerCase();

export async function getCustomer(email) {
  const key = normEmail(email);
  if (!key) return null;
  try { return await store().get(key, { type: 'json' }); }
  catch { return null; }
}

export async function getOrCreateCustomer(email) {
  const key = normEmail(email);
  const existing = await getCustomer(key);
  if (existing) return existing;
  const now = new Date().toISOString();
  const fresh = { email: key, name: '', phone: '', address: '', city: '', state: '', pincode: '', landmark: '', createdAt: now, updatedAt: now };
  await store().setJSON(key, fresh);
  return fresh;
}

export async function updateCustomer(email, patch) {
  const key = normEmail(email);
  if (!key) throw new Error('email required');
  const existing = (await getCustomer(key)) || { email: key, createdAt: new Date().toISOString() };
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const next = {
    ...existing,
    name: patch.name !== undefined ? str(patch.name, 120) : existing.name || '',
    phone: patch.phone !== undefined ? str(patch.phone, 20) : existing.phone || '',
    address: patch.address !== undefined ? str(patch.address, 240) : existing.address || '',
    city: patch.city !== undefined ? str(patch.city, 80) : existing.city || '',
    state: patch.state !== undefined ? str(patch.state, 80) : existing.state || '',
    pincode: patch.pincode !== undefined ? str(patch.pincode, 12) : existing.pincode || '',
    landmark: patch.landmark !== undefined ? str(patch.landmark, 160) : existing.landmark || '',
    email: key,
    updatedAt: new Date().toISOString(),
  };
  await store().setJSON(key, next);
  return next;
}

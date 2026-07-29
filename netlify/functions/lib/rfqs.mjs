/* ============================================================
   RFQs (request-for-quotation) — Netlify Blobs. Each RFQ is its own
   key (by rid) in xanvor-rfqs; xanvor-rfqs-index maps email -> [rids]
   (plus a special "__all__" key with every rid) so the admin RFQ list
   doesn't need a full-store scan. Mirrors lib/orders.mjs exactly.
   ============================================================ */
import { getStore } from '@netlify/blobs';
import { randomInt } from 'node:crypto';

const rfqStore = () => getStore({ name: 'xanvor-rfqs', consistency: 'strong' });
const indexStore = () => getStore({ name: 'xanvor-rfqs-index', consistency: 'strong' });
const ALL_KEY = '__all__';
const normEmail = (email) => String(email || '').trim().toLowerCase();

export const RFQ_STATUSES = ['new', 'reviewing', 'quoted', 'won', 'lost'];

async function appendToIndex(key, rid) {
  const store = indexStore();
  const list = (await store.get(key, { type: 'json' })) || [];
  if (!list.includes(rid)) list.unshift(rid);
  await store.setJSON(key, list);
}

/* Reference the buyer can quote back: XV-RFQ-20260729-4821 (IST date).
   Uniqueness is checked against the store; collisions retry. */
export async function newRid() {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).replace(/-/g, '');
  for (let i = 0; i < 6; i++) {
    const rid = `XV-RFQ-${day}-${randomInt(1000, 10000)}`;
    if (!(await getRfq(rid))) return rid;
  }
  return `XV-RFQ-${day}-${Date.now().toString(36).toUpperCase()}`;
}

export async function createRfq(rfq) {
  const now = new Date().toISOString();
  const record = {
    ...rfq,
    email: normEmail(rfq.email),
    status: 'new',
    createdAt: now,
    statusHistory: [{ status: 'new', at: now }],
  };
  await rfqStore().setJSON(record.rid, record);
  await appendToIndex(record.email, record.rid);
  await appendToIndex(ALL_KEY, record.rid);
  return record;
}

export async function getRfq(rid) {
  try { return await rfqStore().get(String(rid || ''), { type: 'json' }); }
  catch { return null; }
}

async function hydrate(rids) {
  const rfqs = await Promise.all(rids.map((rid) => getRfq(rid)));
  return rfqs
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getAllRfqs() {
  const rids = (await indexStore().get(ALL_KEY, { type: 'json' })) || [];
  return hydrate(rids);
}

export async function deleteRfq(rid) {
  const rfq = await getRfq(rid);
  if (!rfq) return false;
  await rfqStore().delete(rid);
  const removeFrom = async (key) => {
    const store = indexStore();
    const list = (await store.get(key, { type: 'json' })) || [];
    const next = list.filter((x) => x !== rid);
    if (next.length !== list.length) await store.setJSON(key, next);
  };
  await removeFrom(rfq.email);
  await removeFrom(ALL_KEY);
  return true;
}

export async function updateRfqStatus(rid, patch) {
  const rfq = await getRfq(rid);
  if (!rfq) return null;
  const now = new Date().toISOString();
  const previousStatus = rfq.status;
  const next = { ...rfq, updatedAt: now };
  if (patch.status && RFQ_STATUSES.includes(patch.status)) next.status = patch.status;
  if (patch.adminNotes !== undefined) next.adminNotes = String(patch.adminNotes).trim().slice(0, 2000);
  if (next.status !== previousStatus) {
    next.statusHistory = [...(rfq.statusHistory || []), { status: next.status, at: now }];
  }
  await rfqStore().setJSON(rid, next);
  return { rfq: next, previousStatus, statusChanged: next.status !== previousStatus };
}

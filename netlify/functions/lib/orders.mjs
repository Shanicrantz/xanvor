/* ============================================================
   Orders — Netlify Blobs. Each order is its own key (by oid) in
   xanvor-orders; xanvor-orders-index maps email -> [oids] (plus a
   special "__all__" key with every oid ever created) so "my orders"
   and the admin order list don't need a full-store scan.
   ============================================================ */
import { getStore } from '@netlify/blobs';

const orderStore = () => getStore({ name: 'xanvor-orders', consistency: 'strong' });
const indexStore = () => getStore({ name: 'xanvor-orders-index', consistency: 'strong' });
const ALL_KEY = '__all__';
const normEmail = (email) => String(email || '').trim().toLowerCase();

async function appendToIndex(key, oid) {
  const store = indexStore();
  const list = (await store.get(key, { type: 'json' })) || [];
  if (!list.includes(oid)) list.unshift(oid);
  await store.setJSON(key, list);
}

export async function createOrder(order) {
  const now = new Date().toISOString();
  const record = {
    ...order,
    email: normEmail(order.email),
    createdAt: now,
    statusHistory: [{ status: order.status, at: now }],
  };
  await orderStore().setJSON(record.oid, record);
  await appendToIndex(record.email, record.oid);
  await appendToIndex(ALL_KEY, record.oid);
  return record;
}

export async function getOrder(oid) {
  try { return await orderStore().get(String(oid || ''), { type: 'json' }); }
  catch { return null; }
}

async function hydrate(oids) {
  const orders = await Promise.all(oids.map((oid) => getOrder(oid)));
  return orders
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getOrdersByEmail(email) {
  const key = normEmail(email);
  if (!key) return [];
  const oids = (await indexStore().get(key, { type: 'json' })) || [];
  return hydrate(oids);
}

export async function getAllOrders() {
  const oids = (await indexStore().get(ALL_KEY, { type: 'json' })) || [];
  return hydrate(oids);
}

export async function deleteOrder(oid) {
  const order = await getOrder(oid);
  if (!order) return false;
  await orderStore().delete(oid);
  const removeFrom = async (key) => {
    const store = indexStore();
    const list = (await store.get(key, { type: 'json' })) || [];
    const next = list.filter((x) => x !== oid);
    if (next.length !== list.length) await store.setJSON(key, next);
  };
  await removeFrom(order.email);
  await removeFrom(ALL_KEY);
  return true;
}

const NOTIFY_STATUSES = ['confirmed', 'shipped', 'delivered', 'cancelled'];

export async function updateOrderStatus(oid, patch) {
  const order = await getOrder(oid);
  if (!order) return null;
  const now = new Date().toISOString();
  const previousStatus = order.status;
  const next = { ...order, updatedAt: now };
  if (patch.status) next.status = patch.status;
  if (patch.tracking !== undefined) next.tracking = String(patch.tracking).trim().slice(0, 120);
  if (patch.carrier !== undefined) next.carrier = String(patch.carrier).trim().slice(0, 80);

  const statusChanged = next.status !== previousStatus;
  /* only log a history entry when the status actually changes — a plain
     tracking/carrier edit (or a duplicate Save) shouldn't bloat the trail */
  if (statusChanged) next.statusHistory = [...(order.statusHistory || []), { status: next.status, at: now }];

  /* Decide whether the CUSTOMER should be emailed for this save. `notifiedKeys`
     records notifications already sent so each is sent at most once — this makes
     back-and-forth status flips (shipped→delivered→shipped) NOT re-email, and
     duplicate/carrier-only saves NOT email. For 'shipped' the key folds in the
     tracking number, so adding the AWB *after* marking shipped emails exactly
     once more — this time carrying the tracking block. */
  const notified = Array.isArray(order.notifiedKeys) ? order.notifiedKeys : [];
  const notifyKey = next.status === 'shipped' ? `shipped:${next.tracking || ''}` : next.status;
  const shouldNotify = NOTIFY_STATUSES.includes(next.status) && !notified.includes(notifyKey);
  if (shouldNotify) next.notifiedKeys = [...notified, notifyKey];

  await orderStore().setJSON(oid, next);
  return { order: next, previousStatus, statusChanged, shouldNotify };
}

/* ============================================================
   Visitor analytics + lead capture — first-party, Netlify Blobs.
   Deliberately stores NO IP address: geo comes from Netlify's edge
   context (city/country only) and the device string from the UA.
   Sessions expire from the "recent" index by cap, not by cron.
   ============================================================ */
import { getStore } from '@netlify/blobs';

const visits = () => getStore({ name: 'xanvor-visits', consistency: 'strong' });
const leads = () => getStore({ name: 'xanvor-leads', consistency: 'strong' });

const RECENT_KEY = 'recent';
const RECENT_CAP = 400;      // sessions kept in the fast index
const VIEWS_CAP = 40;        // pages remembered per session
const EVENTS_CAP = 25;
export const LIVE_WINDOW_MS = 5 * 60 * 1000;  // "on site now" = seen in last 5 min

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const sidOk = (s) => /^[a-zA-Z0-9_-]{8,40}$/.test(String(s || ''));

/* "/" and "/index.html" are the same page to a shop owner — fold them so the
   top-pages list doesn't show Home twice. Query strings stay (they carry the
   product id, which is the interesting part of a PDP hit). */
const normPath = (p) => {
  let s = str(p, 200);
  if (!s) return s;
  s = s.replace(/\/index\.html(?=$|\?)/, '/');
  if (s !== '/' && s.startsWith('//')) s = s.slice(1);
  return s;
};

/* ---- recent index (newest first, deduped, capped) ---- */
async function pushRecent(store, key, id) {
  const list = (await store.get(key, { type: 'json' })) || [];
  const next = [id, ...list.filter((x) => x !== id)].slice(0, RECENT_CAP);
  await store.setJSON(key, next);
}

/* ---- sessions ---- */
export async function getSession(sid) {
  if (!sidOk(sid)) return null;
  try { return await visits().get('s/' + sid, { type: 'json' }); }
  catch { return null; }
}

/**
 * Records a hit on a session, creating it on first contact.
 * kind: 'view' (page view) | 'ping' (heartbeat) | 'event' (named action)
 */
export async function recordHit({ sid, vid, kind, path, title, ref, utm, device, browser, geo, visits: visitCount, event, meta, identity }) {
  if (!sidOk(sid)) throw new Error('bad session id');
  const store = visits();
  const now = new Date().toISOString();
  const existing = await getSession(sid);

  const session = existing || {
    sid,
    vid: str(vid, 40),
    firstSeen: now,
    lastSeen: now,
    ref: str(ref, 160) || 'direct',
    utm: utm && Object.keys(utm).length ? utm : undefined,
    device: str(device, 20),
    browser: str(browser, 40),
    geo: geo || undefined,
    visits: Number(visitCount) || 1,
    views: [],
    events: [],
  };

  session.lastSeen = now;
  /* late-arriving geo/device (first beacon may lack it) */
  if (!session.geo && geo) session.geo = geo;
  if (!session.device && device) session.device = str(device, 20);

  if (kind === 'view' && path) {
    const p = normPath(path);
    const last = session.views[session.views.length - 1];
    /* don't double-log a refresh of the same page within 2s */
    if (!last || last.p !== p || (Date.now() - new Date(last.at).getTime()) > 2000) {
      session.views.push({ p, t: str(title, 140), at: now });
      if (session.views.length > VIEWS_CAP) session.views = session.views.slice(-VIEWS_CAP);
    }
  }

  if (kind === 'event' && event) {
    session.events.push({ e: str(event, 40), at: now, meta: meta ? str(JSON.stringify(meta), 300) : undefined });
    if (session.events.length > EVENTS_CAP) session.events = session.events.slice(-EVENTS_CAP);
  }

  /* identity gets attached once the visitor gives an email/phone or checks out */
  if (identity) {
    if (identity.email) session.email = str(identity.email, 160).toLowerCase();
    if (identity.phone) session.phone = str(identity.phone, 20);
    if (identity.name) session.name = str(identity.name, 120);
  }

  await store.setJSON('s/' + sid, session);
  if (!existing) await pushRecent(store, RECENT_KEY, sid);
  return session;
}

export async function getRecentSessions(limit = 120) {
  const store = visits();
  let ids = (await store.get(RECENT_KEY, { type: 'json' })) || [];
  if (!ids.length) {
    /* index empty (first run / lost write) — fall back to listing the store */
    try {
      const { blobs } = await store.list({ prefix: 's/' });
      ids = (blobs || []).map((b) => b.key.slice(2));
    } catch { /* leave empty */ }
  }
  const picked = ids.slice(0, Math.min(limit, RECENT_CAP));
  const sessions = await Promise.all(picked.map((id) => getSession(id)));
  return sessions
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

export function summarise(sessions) {
  const cutoff = Date.now() - LIVE_WINDOW_MS;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const live = sessions.filter((s) => new Date(s.lastSeen).getTime() > cutoff);
  const today = sessions.filter((s) => new Date(s.firstSeen).getTime() > dayAgo);
  const pageCounts = {};
  today.forEach((s) => (s.views || []).forEach((v) => { pageCounts[v.p] = (pageCounts[v.p] || 0) + 1; }));
  const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([path, hits]) => ({ path, hits }));
  return {
    liveCount: live.length,
    todaySessions: today.length,
    todayViews: today.reduce((n, s) => n + (s.views || []).length, 0),
    topPages,
  };
}

/* ---- leads (offer popup captures) ---- */
const leadKey = (email, phone) => {
  const e = String(email || '').trim().toLowerCase();
  const p = String(phone || '').replace(/\D/g, '');
  return e ? 'l/e:' + e : 'l/p:' + p;
};

export async function saveLead(lead) {
  const email = str(lead.email, 160).toLowerCase();
  const phone = str(lead.phone, 20);
  if (!email && !phone) throw new Error('email ya phone chahiye');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('valid email daalo');
  const digits = phone.replace(/\D/g, '');
  if (phone && (digits.length < 10 || digits.length > 13)) throw new Error('valid phone daalo');

  const store = leads();
  const key = leadKey(email, phone);
  const existing = await store.get(key, { type: 'json' });
  const now = new Date().toISOString();
  const record = {
    key,
    email: email || existing?.email || '',
    phone: phone || existing?.phone || '',
    name: str(lead.name, 120) || existing?.name || '',
    source: str(lead.source, 40) || 'offer-popup',
    coupon: str(lead.coupon, 30) || existing?.coupon || '',
    sid: str(lead.sid, 40),
    geo: lead.geo || existing?.geo || undefined,
    pages: Array.isArray(lead.pages) ? lead.pages.slice(-6).map((p) => str(p, 200)) : existing?.pages,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    seen: existing?.seen ? existing.seen + 1 : 1,
  };
  await store.setJSON(key, record);
  await pushRecent(store, RECENT_KEY, key);
  return { record, isNew: !existing };
}

export async function getLeads(limit = 300) {
  const store = leads();
  let keys = (await store.get(RECENT_KEY, { type: 'json' })) || [];
  if (!keys.length) {
    try {
      const { blobs } = await store.list({ prefix: 'l/' });
      keys = (blobs || []).map((b) => b.key);
    } catch { /* leave empty */ }
  }
  const rows = await Promise.all(keys.slice(0, limit).map(async (k) => {
    try { return await store.get(k, { type: 'json' }); } catch { return null; }
  }));
  return rows.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function deleteLead(key) {
  if (!String(key || '').startsWith('l/')) return false;
  const store = leads();
  const existing = await store.get(key, { type: 'json' });
  if (!existing) return false;
  await store.delete(key);
  const list = (await store.get(RECENT_KEY, { type: 'json' })) || [];
  await store.setJSON(RECENT_KEY, list.filter((k) => k !== key));
  return true;
}

/* ---- request helpers ---- */
export function deviceFromUA(ua = '') {
  const s = String(ua);
  const device = /iPad|Tablet/i.test(s) ? 'tablet' : /Mobi|Android|iPhone/i.test(s) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera'
    : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari'
    : /Firefox\//.test(s) ? 'Firefox' : 'Other';
  return { device, browser };
}

export function geoFromContext(context) {
  const g = context && context.geo;
  if (!g) return undefined;
  const out = {};
  if (g.city) out.city = str(g.city, 60);
  if (g.subdivision && g.subdivision.name) out.region = str(g.subdivision.name, 60);
  if (g.country && g.country.code) out.country = str(g.country.code, 4);
  return Object.keys(out).length ? out : undefined;
}

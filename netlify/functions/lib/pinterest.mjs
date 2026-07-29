/* ============================================================
   Pinterest pipeline core — token handling, pin building, batch
   posting. Shared by pinterest-post.mjs (manual/API) and
   pinterest-cron.mjs (daily schedule).

   Blobs store 'xanvor-pinterest' (strong consistency):
     'auth'   → {accessToken, accessExpiresAt, refreshToken, refreshExpiresAt}
     'pinned' → {productId: {pinId, title, at}}

   Env vars:
     PINTEREST_API_BASE      (default https://api.pinterest.com/v5;
                              sandbox: https://api-sandbox.pinterest.com/v5)
     PINTEREST_ACCESS_TOKEN  static token → sandbox/static mode (no refresh)
     PINTEREST_APP_ID / PINTEREST_APP_SECRET / PINTEREST_REFRESH_TOKEN
                             continuous-refresh OAuth mode
     PINTEREST_BOARD_ID      board that receives the pins

   CRITICAL: Pinterest continuous refresh tokens ROTATE on every
   refresh call and die after 60 days if the rotated token is not
   persisted — always save the new refreshToken back to Blobs.
   ============================================================ */
import { getStore } from '@netlify/blobs';
import { getCatalog } from './catalog.mjs';
import { liveOnly, productURL, imageURL, galleryOf } from './render.mjs';

const STORE = 'xanvor-pinterest';
const AUTH_KEY = 'auth';
const PINNED_KEY = 'pinned';
const FRESH_MS = 5 * 60 * 1000; // access token must be valid >5min to reuse

const store = () => getStore({ name: STORE, consistency: 'strong' });

export const apiBase = () =>
  (process.env.PINTEREST_API_BASE || 'https://api.pinterest.com/v5').replace(/\/+$/, '');

/* ---- configuration status (env-only, sync) ---- */
export function isConfigured() {
  if (!process.env.PINTEREST_BOARD_ID) {
    return { ok: false, mode: 'unconfigured', reason: 'PINTEREST_BOARD_ID env var not set' };
  }
  if (process.env.PINTEREST_ACCESS_TOKEN) {
    return { ok: true, mode: 'static-token', reason: null };
  }
  const missing = ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_REFRESH_TOKEN']
    .filter(k => !process.env[k]);
  if (!missing.length) return { ok: true, mode: 'oauth-refresh', reason: null };
  return {
    ok: false, mode: 'unconfigured',
    reason: `Set PINTEREST_ACCESS_TOKEN (sandbox/static) or the OAuth vars — missing: ${missing.join(', ')}`,
  };
}

/* ---- token ---- */
export async function getAccessToken() {
  /* static/sandbox mode: dashboard-generated token, no refresh flow */
  if (process.env.PINTEREST_ACCESS_TOKEN) return process.env.PINTEREST_ACCESS_TOKEN;

  const s = store();
  let auth = null;
  try { auth = await s.get(AUTH_KEY, { type: 'json' }); } catch { /* treat as empty */ }

  /* bootstrap: first run seeds the store from the env refresh token */
  if (!auth || !auth.refreshToken) {
    const seed = process.env.PINTEREST_REFRESH_TOKEN;
    if (!seed) throw new Error('Pinterest auth not configured: no PINTEREST_ACCESS_TOKEN, no stored/env refresh token');
    auth = { refreshToken: seed };
  }

  /* reuse the stored access token while it's comfortably valid */
  if (auth.accessToken && auth.accessExpiresAt
      && Date.parse(auth.accessExpiresAt) - Date.now() > FRESH_MS) {
    return auth.accessToken;
  }

  /* refresh — and PERSIST THE ROTATED REFRESH TOKEN (rotates every call) */
  const id = process.env.PINTEREST_APP_ID, secret = process.env.PINTEREST_APP_SECRET;
  if (!id || !secret) throw new Error('PINTEREST_APP_ID / PINTEREST_APP_SECRET env vars not set');
  const res = await fetch(`${apiBase()}/oauth/token`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refreshToken }),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Pinterest token refresh failed (${res.status}): ${text}`);
  }
  const tok = await res.json();
  const now = Date.now();
  const next = {
    accessToken: tok.access_token,
    accessExpiresAt: new Date(now + (Number(tok.expires_in) || 2592000) * 1000).toISOString(),
    /* if Pinterest ever omits a new refresh token, keep the one that worked */
    refreshToken: tok.refresh_token || auth.refreshToken,
    refreshExpiresAt: new Date(now + (Number(tok.refresh_token_expires_in) || 5184000) * 1000).toISOString(),
  };
  await s.setJSON(AUTH_KEY, next);
  return next.accessToken;
}

/* ---- pinned ledger ---- */
export async function getPinned() {
  try {
    const data = await store().get(PINNED_KEY, { type: 'json' });
    return (data && typeof data === 'object') ? data : {};
  } catch { return {}; }
}

/* ---- text helpers ---- */
const firstMaterialOf = (p) => String(p.materials || '').split('·')[0].trim();
const naturalMaterials = (p) => String(p.materials || '').split('·').map(x => x.trim()).filter(Boolean).join(' and ');

/* cut at a word boundary, never mid-word */
const smartCut = (s, max) => {
  s = String(s || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s—·,-]+$/, '');
};

/* ---- pin payload from a catalogue product ---- */
export function buildPin(p) {
  const name = String(p.name || '').trim();
  const mat = firstMaterialOf(p);
  const matsNatural = naturalMaterials(p);

  /* title ≤100, product keyword front-loaded; drop suffix pieces to fit */
  const title = [
    `${name} — Handcrafted ${mat} Decor from India`,
    `${name} — Handcrafted ${mat} Decor`,
    `${name} — Handcrafted Decor from India`,
    name,
  ].map(t => t.replace(/\s+/g, ' ').trim()).find(t => t.length <= 100) || smartCut(name, 100);

  /* description ≤800, natural sentences, no hashtags */
  const description = smartCut([
    `${name}${matsNatural ? `, crafted in ${matsNatural}` : ''}${p.collection ? `, from the XANVOR ${p.collection} collection` : ''}.`,
    'Handcrafted in Moradabad, India. Worldwide shipping · wholesale & OEM enquiries welcome.',
    'Shop or request a quote at xanvor.com',
  ].join(' '), 800);

  /* alt text ≤500 — literal visual description for accessibility + image search */
  const alt_text = smartCut(
    `${name}${matsNatural ? ` made of ${matsNatural}` : ''}, a handcrafted metal decor piece from Moradabad, India.`,
    500);

  /* productURL already carries ?id=… so UTM params join with '&' */
  const base = productURL(p);
  const link = base + (base.includes('?') ? '&' : '?')
    + 'utm_source=pinterest&utm_medium=social&utm_campaign=new-designs';

  /* full-res primary image (images[0] || image) as an absolute URL —
     never the resized /img CDN variant */
  const img = galleryOf(p)[0];

  return {
    board_id: process.env.PINTEREST_BOARD_ID,
    title, description, link, alt_text,
    media_source: { source_type: 'image_url', url: imageURL({ image: img }) },
  };
}

/* ---- eligible queue: live + has image, newest designs first ---- */
export async function getQueue() {
  const cat = await getCatalog();
  const eligible = liveOnly(cat.products).filter(p => galleryOf(p)[0]);
  eligible.sort((a, b) => {
    const ta = a.modified_at ? Date.parse(a.modified_at) : 0; // missing → oldest → last
    const tb = b.modified_at ? Date.parse(b.modified_at) : 0;
    return tb - ta;
  });
  const pinned = await getPinned();
  const queue = eligible.filter(p => !pinned[p.id]);
  return { eligible, queue, pinned };
}

/* ---- post the next N unpinned products ---- */
export async function postNextPins(count) {
  const n = Math.max(1, Math.min(10, Number(count) || 3));
  const { eligible, queue, pinned } = await getQueue();
  const batch = queue.slice(0, n);

  const posted = [], failed = [];
  let rateLimited = false;

  if (batch.length) {
    const token = await getAccessToken();
    for (const p of batch) {
      const body = buildPin(p);
      const res = await fetch(`${apiBase()}/pins`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) { rateLimited = true; break; } // stop the batch, keep what got done
      if (res.status === 201) {
        const pin = await res.json().catch(() => ({}));
        pinned[p.id] = { pinId: pin.id || '', title: body.title, at: new Date().toISOString() };
        await store().setJSON(PINNED_KEY, pinned); // persist per pin — survive mid-batch failures
        posted.push({ id: p.id, pinId: pinned[p.id].pinId });
      } else {
        const text = (await res.text().catch(() => '')).slice(0, 300);
        failed.push({ id: p.id, status: res.status, error: text });
      }
    }
  }

  const result = {
    posted, failed,
    skippedAlreadyPinned: eligible.length - queue.length,
    remaining: queue.length - posted.length,
  };
  if (rateLimited) result.rateLimited = true;
  return result;
}

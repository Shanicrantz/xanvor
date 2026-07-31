/* ============================================================
   /api/pinterest/boards — list the account's boards with their ids,
   and propose a ready-to-paste PINTEREST_BOARD_MAP.
   Auth: x-admin-key header must match XANVOR_ADMIN_KEY env var.

   Board ids are only obtainable from the API (the Pinterest web UI
   never shows them), and PINTEREST_BOARD_MAP is keyed by catalogue
   collection — so this endpoint does the matching and reports what
   it could NOT match rather than guessing. Needs the OAuth vars set;
   PINTEREST_BOARD_MAP itself is not required to call it.
   Token values are NEVER included in any response.
   ============================================================ */
import { createHash, timingSafeEqual } from 'node:crypto';
import { apiBase, getAccessToken } from './lib/pinterest.mjs';
import { getCatalog } from './lib/catalog.mjs';
import { liveOnly } from './lib/render.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 1), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const keysMatch = (a, b) => {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
};

/* significant words, lowercased — "Sheesham & Wood" → ['sheesham','wood'] */
const STOP = new Set(['and', 'the', 'of', 'for', 'a', 'an']);
const words = (s) => String(s || '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(w => w && w.length > 2 && !STOP.has(w));

/* score a collection against a board name by shared significant words */
const overlap = (a, b) => {
  const wb = new Set(words(b));
  return words(a).filter(w => wb.has(w)).length;
};

export default async (req) => {
  const adminKey = process.env.XANVOR_ADMIN_KEY;
  if (!adminKey) return json({ error: 'Setup needed: set the XANVOR_ADMIN_KEY environment variable in Netlify.' }, 503);
  if (!keysMatch(req.headers.get('x-admin-key') || '', adminKey)) return json({ error: 'Galat admin key' }, 401);

  try {
    const token = await getAccessToken();

    /* page through /v5/boards — an account can exceed one page */
    const boards = [];
    let bookmark = '';
    for (let page = 0; page < 20; page++) {
      const url = `${apiBase()}/boards?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ''}`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).slice(0, 300);
        return json({ error: `Pinterest API ${res.status}`, detail: text }, 502);
      }
      const body = await res.json();
      for (const b of body.items || []) boards.push({ id: b.id, name: b.name, privacy: b.privacy });
      bookmark = body.bookmark || '';
      if (!bookmark) break;
    }

    /* propose the map: one board per catalogue collection */
    const { products } = await getCatalog();
    const collections = [...new Set(liveOnly(products).map(p => p.collection).filter(Boolean))];

    const suggested = {}, unmatched = [];
    for (const c of collections) {
      const exact = boards.find(b => b.name.trim().toLowerCase() === c.trim().toLowerCase());
      if (exact) { suggested[c] = exact.id; continue; }
      const ranked = boards
        .map(b => ({ b, score: overlap(c, b.name) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);
      /* only auto-assign a clear winner — a tie means a human should choose */
      if (ranked.length && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
        suggested[c] = ranked[0].b.id;
      } else {
        unmatched.push(c);
      }
    }

    return json({
      boards,
      collections,
      suggested_board_map: suggested,
      unmatched_collections: unmatched,
      note: unmatched.length
        ? `Add a board id for these collections by hand before using the map: ${unmatched.join(', ')}`
        : 'Every collection matched a board. Paste suggested_board_map into PINTEREST_BOARD_MAP.',
    });
  } catch (e) {
    return json({ error: e.message || 'failed' }, 500);
  }
};

export const config = { path: '/api/pinterest/boards' };

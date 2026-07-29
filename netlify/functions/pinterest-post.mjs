/* ============================================================
   /api/pinterest/post — manual Pinterest posting + status
   Auth: x-admin-key header must match XANVOR_ADMIN_KEY env var.
     GET          → status {configured, reason, mode, boardId,
                            pinnedCount, lastPosted, catalogRemaining}
     POST {count} → post the next `count` (1..10, default 3) unpinned
                    products as fresh pins, newest designs first.
   Token values are NEVER included in any response.
   ============================================================ */
import { createHash, timingSafeEqual } from 'node:crypto';
import { isConfigured, getPinned, getQueue, postNextPins } from './lib/pinterest.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const keysMatch = (a, b) => {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
};

export default async (req) => {
  const adminKey = process.env.XANVOR_ADMIN_KEY;
  if (!adminKey) return json({ error: 'Setup needed: set the XANVOR_ADMIN_KEY environment variable in Netlify.' }, 503);
  const given = req.headers.get('x-admin-key') || '';
  if (!keysMatch(given, adminKey)) return json({ error: 'Galat admin key' }, 401);

  try {
    if (req.method === 'GET') {
      const cfg = isConfigured();
      const pinned = await getPinned();
      const lastPosted = Object.entries(pinned)
        .map(([id, v]) => ({ id, pinId: v.pinId, title: v.title, at: v.at }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 10);
      let catalogRemaining = 0;
      try { catalogRemaining = (await getQueue()).queue.length; } catch { /* catalog read best-effort */ }
      return json({
        configured: cfg.ok,
        reason: cfg.reason,
        mode: cfg.mode,
        boardId: !!process.env.PINTEREST_BOARD_ID,
        pinnedCount: Object.keys(pinned).length,
        lastPosted,
        catalogRemaining,
      });
    }

    if (req.method === 'POST') {
      const cfg = isConfigured();
      if (!cfg.ok) return json({ error: `Pinterest not configured: ${cfg.reason}` }, 503);
      let body = {};
      try { body = await req.json(); } catch { /* empty body → defaults */ }
      const count = Math.max(1, Math.min(10, Number(body.count) || 3));
      const result = await postNextPins(count);
      return json({ ok: true, ...result });
    }

    return json({ error: 'GET or POST only' }, 405);
  } catch (e) {
    return json({ error: e.message || 'failed' }, 500);
  }
};

export const config = { path: '/api/pinterest/post' };

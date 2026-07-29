/* ============================================================
   Daily Pinterest cron — posts the next few unpinned designs
   (newest first) every day. Pins/day comes from the
   PINTEREST_PINS_PER_DAY env var (1..10, default 3).
   Skips quietly when Pinterest env vars aren't configured, and
   never throws — a failed run must not mark the function broken.
   ============================================================ */
import { isConfigured, postNextPins } from './lib/pinterest.mjs';

export default async () => {
  try {
    const cfg = isConfigured();
    if (!cfg.ok) {
      console.log(JSON.stringify({ pinterestCron: 'skipped', reason: cfg.reason }));
      return new Response('skipped');
    }
    const perDay = Math.max(1, Math.min(10, Number(process.env.PINTEREST_PINS_PER_DAY) || 3));
    const result = await postNextPins(perDay);
    console.log(JSON.stringify({ pinterestCron: 'ran', mode: cfg.mode, perDay, ...result }));
    return new Response('ok');
  } catch (e) {
    console.log(JSON.stringify({ pinterestCron: 'error', error: e.message || String(e) }));
    return new Response('error logged');
  }
};

/* schedule only — a scheduled function must NOT also declare a path */
export const config = { schedule: '@daily' };

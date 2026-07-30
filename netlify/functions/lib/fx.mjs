/* ============================================================
   FX reference rates — INR base, display-only.

   These rates NEVER touch money we charge. Razorpay settles INR
   (pay-create-order.mjs), export orders settle in the currency
   printed on the Proforma Invoice. Everything here exists so an
   international buyer can eyeball a price in their own currency.

   Storage: Blobs store 'xanvor-fx', key 'rates':
     { base:'INR', at:<iso>, source:<string>, rates:{ USD:0.0114, … } }
   A rate is "1 INR = X <currency>", so converted = inr * rates[code].

   Refresh: netlify/functions/fx-cron.mjs (@daily). Served to the
   browser by /api/fx. If every provider fails we fall back to the
   baked table below and SAY SO in the payload (stale:true) so the
   UI can warn instead of quietly showing year-old numbers.
   ============================================================ */
import { getStore } from '@netlify/blobs';

const STORE = 'xanvor-fx';
const KEY = 'rates';
const store = () => getStore({ name: STORE, consistency: 'strong' });

/* Currencies the site can display. Keep in sync with assets/currency.js. */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'SAR', 'QAR', 'JPY', 'SGD'];

/* Last-resort baked rates (1 INR = X), captured live from Frankfurter and
   cross-checked against open.er-api on the date below. Only used if every
   provider is unreachable AND the store is empty — e.g. a first deploy with
   no egress. The UI labels anything this old as out of date. */
const FALLBACK = {
  USD: 0.01044, EUR: 0.00916, GBP: 0.00785, AED: 0.03834, CAD: 0.01472,
  AUD: 0.01501, SAR: 0.03915, QAR: 0.038, JPY: 1.7106, SGD: 0.01349,
};
const FALLBACK_AT = '2026-07-30T00:00:00.000Z';

const TIMEOUT_MS = 6000;

/* Providers are tried in order. Each returns {code: rateFromINR} or throws.
   Both are free, keyless and permit commercial use; both were verified live
   to cover all ten currencies with INR as base, and agree to ~4 decimals. */
const PROVIDERS = [
  {
    /* MIT-licensed, no quotas, central-bank sourced. NOTE: the v2 endpoint
       returns an ARRAY of {date, base, quote, rate} — not a rates object —
       and api.frankfurter.APP now 301-redirects, so the .dev host matters. */
    name: 'frankfurter',
    url: () => `https://api.frankfurter.dev/v2/rates?base=INR&quotes=${CURRENCIES.join(',')}`,
    parse: (j) => {
      if (!Array.isArray(j)) throw new Error('expected an array');
      const out = {};
      for (const row of j) if (row && row.quote) out[row.quote] = row.rate;
      return out;
    },
  },
  {
    name: 'open.er-api',
    url: () => 'https://open.er-api.com/v6/latest/INR',
    parse: (j) => {
      if (!j || j.result !== 'success' || !j.rates) throw new Error('bad result');
      const out = {};
      for (const c of CURRENCIES) if (typeof j.rates[c] === 'number') out[c] = j.rates[c];
      return out;
    },
  },
];

/* A rate set is only accepted if it covers every currency with a sane,
   positive number — a half-populated response would silently drop
   currencies from the switcher. */
function validate(rates) {
  const out = {};
  for (const c of CURRENCIES) {
    const v = Number(rates[c]);
    if (!Number.isFinite(v) || v <= 0 || v > 1000) throw new Error(`bad/missing rate for ${c}`);
    out[c] = v;
  }
  return out;
}

export async function fetchRates() {
  const errors = [];
  for (const p of PROVIDERS) {
    try {
      const res = await fetch(p.url(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rates = validate(p.parse(await res.json()));
      return { base: 'INR', at: new Date().toISOString(), source: p.name, rates };
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(`all FX providers failed — ${errors.join('; ')}`);
}

export async function getStoredRates() {
  try {
    const data = await store().get(KEY, { type: 'json' });
    if (data && data.rates && typeof data.rates === 'object') return data;
  } catch { /* fall through to the baked table */ }
  return { base: 'INR', at: FALLBACK_AT, source: 'fallback', rates: FALLBACK };
}

export async function refreshRates() {
  const fresh = await fetchRates();
  await store().setJSON(KEY, fresh);
  return fresh;
}

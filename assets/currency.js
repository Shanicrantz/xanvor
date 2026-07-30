/* ============================================================
   XANVOR — display-currency layer (international buyer support)

   WHAT THIS IS: a way for an overseas buyer to read our prices in
   their own currency. Nothing here changes what anyone is charged.

   WHAT WE ACTUALLY CHARGE:
     · retail  → INR, via Razorpay (pay-create-order.mjs pins 'INR'),
                 India delivery only
     · export  → the currency printed on the Proforma Invoice
   Every other figure on the site is an indicative conversion.

   DESIGN RULES (each one exists for a reason — don't relax them):
   1. ADDITIVE, NEVER A REPLACEMENT. The ₹ figure stays; the converted
      amount sits beside it as "≈ $42". Replacing ₹ would advertise a
      price we cannot take, and would break Google Merchant Center's
      landing-page rule that the page must show the feed price.
   2. NO SILENT GEO SWITCH. We offer, the buyer chooses. Merchant Center
      explicitly disallows geo-IP price defaulting, and VPN/travelling
      Indian buyers would otherwise find the store in dollars.
   3. CHECKOUT IS NEVER CONVERTED. That page shows what Razorpay will
      charge, full stop.
   4. WHOLE UNITS ONLY, ALWAYS PREFIXED "≈". Cents imply a precision an
      indicative daily rate does not have.
   ============================================================ */
(function () {
  'use strict';

  var STORE_CUR = 'xv_cur';        // chosen currency code
  var STORE_SRC = 'xv_cur_src';    // 'user' | 'suggested'
  var STORE_GEO = 'xv_geo_v1';     // { c, at } 30-day cache
  var STORE_OFF = 'xv_cur_offered'; // '1' once we've offered, never re-offer

  /* Display currencies. INR is the base and the "off" state.
     Keep in sync with CURRENCIES in netlify/functions/lib/fx.mjs. */
  var CUR = {
    INR: { sym: '₹',    name: 'Indian Rupee',      locale: 'en-IN', dp: 0 },
    USD: { sym: '$',    name: 'US Dollar',         locale: 'en-US', dp: 0 },
    EUR: { sym: '€',    name: 'Euro',              locale: 'de-DE', dp: 0 },
    GBP: { sym: '£',    name: 'Pound Sterling',    locale: 'en-GB', dp: 0 },
    AED: { sym: 'AED',  name: 'UAE Dirham',        locale: 'en-AE', dp: 0 },
    CAD: { sym: 'C$',   name: 'Canadian Dollar',   locale: 'en-CA', dp: 0 },
    AUD: { sym: 'A$',   name: 'Australian Dollar', locale: 'en-AU', dp: 0 },
    SAR: { sym: 'SAR',  name: 'Saudi Riyal',       locale: 'en-SA', dp: 0 },
    QAR: { sym: 'QAR',  name: 'Qatari Riyal',      locale: 'en-QA', dp: 0 },
    JPY: { sym: '¥',    name: 'Japanese Yen',      locale: 'ja-JP', dp: 0 },
    SGD: { sym: 'S$',   name: 'Singapore Dollar',  locale: 'en-SG', dp: 0 }
  };
  var ORDER = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'CAD', 'AUD', 'SGD', 'JPY'];

  /* country → currency we'd suggest. Anything unlisted (and non-IN) → USD. */
  var GEO_CUR = {
    AE: 'AED', SA: 'SAR', QA: 'QAR', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'AUD',
    JP: 'JPY', SG: 'SGD', US: 'USD',
    DE: 'EUR', FR: 'EUR', NL: 'EUR', ES: 'EUR', IT: 'EUR', BE: 'EUR', AT: 'EUR',
    PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', LT: 'EUR',
    LV: 'EUR', EE: 'EUR', LU: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR'
  };

  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  var state = {
    code: 'INR',
    rates: null,      // { USD: 0.01044, … } — 1 INR = x
    at: null,         // ISO timestamp of the rate set
    stale: false,
    country: null
  };

  /* checkout shows what Razorpay charges — never annotate it */
  var IS_CHECKOUT = /checkout\.html$/i.test(location.pathname);

  /* ---------- conversion + formatting ---------- */
  function rateFor(code) {
    if (code === 'INR') return 1;
    return (state.rates && state.rates[code]) || null;
  }

  function convert(inr, code) {
    var r = rateFor(code);
    if (r === null) return null;
    var v = Number(inr) * r;
    /* whole units; sub-unit amounts would read as fake precision */
    return v < 1 ? Math.round(v * 100) / 100 : Math.round(v);
  }

  function format(amount, code) {
    var c = CUR[code] || CUR.USD;
    var n;
    try {
      n = new Intl.NumberFormat(c.locale, { maximumFractionDigits: amount < 1 ? 2 : 0 }).format(amount);
    } catch (e) { n = String(amount); }
    /* three-letter codes read better with a space: "AED 134", "$42" */
    return c.sym.length > 1 ? c.sym + ' ' + n : c.sym + n;
  }

  /* public: format an INR amount in the active currency, additively */
  function approx(inr) {
    if (state.code === 'INR') return '';
    var v = convert(inr, state.code);
    return v === null ? '' : '≈ ' + format(v, state.code);
  }

  /* ---------- the DOM sweep ----------
     Prices on this site come from six different renderers plus two pages of
     hand-written static HTML, and there is no shared money helper — so the
     only mechanism that reaches all of them is a text-node walk. Each ₹ amount
     is wrapped once in a .xv-money span carrying data-inr, which makes
     re-rendering on a currency change lossless and idempotent (we re-read the
     canonical integer, never re-parse a converted string). */
  var MONEY_RE = /₹\s?\d[\d,]*(?:\.\d+)?/;
  var MONEY_RE_G = new RegExp(MONEY_RE.source, 'g');
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TITLE: 1, TEXTAREA: 1, NOSCRIPT: 1, OPTION: 1 };

  function skipEl(el) {
    if (!el || !el.tagName) return true;
    if (SKIP_TAGS[el.tagName]) return true;
    /* opt-out subtrees: payment instructions, coupon amounts, trade tags */
    if (el.closest && el.closest('[data-xv-nomoney]')) return true;
    return false;
  }

  function wrapIn(root) {
    if (IS_CHECKOUT || !root || !root.querySelectorAll) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf('₹') === -1) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (skipEl(p)) return NodeFilter.FILTER_REJECT;
        /* already converted — .xv-money is a leaf as far as we're concerned */
        if (p.classList && p.classList.contains('xv-money')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      MONEY_RE_G.lastIndex = 0;
      while ((m = MONEY_RE_G.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var digits = m[0].replace(/[^\d.]/g, '');
        var inr = parseFloat(digits);
        var span = document.createElement('span');
        span.className = 'xv-money';
        if (Number.isFinite(inr)) span.setAttribute('data-inr', String(inr));
        span.textContent = m[0];
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
  }

  /* paint every wrapped amount for the active currency */
  function paint(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll('.xv-money[data-inr]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var inr = parseFloat(el.getAttribute('data-inr'));
      if (!Number.isFinite(inr)) continue;
      var base = '₹' + Number(inr).toLocaleString('en-IN');
      if (state.code === 'INR' || !rateFor(state.code)) {
        el.textContent = base;
      } else {
        el.innerHTML = '';
        el.appendChild(document.createTextNode(base + ' '));
        var i2 = document.createElement('i');
        i2.className = 'xv-approx';
        i2.textContent = approx(inr);
        el.appendChild(i2);
      }
    }
  }

  var sweepQueued = false, sweeping = false;
  function sweep() {
    if (sweeping) return;
    sweeping = true;
    try { wrapIn(document.body); paint(document); }
    finally { sweeping = false; }
  }
  function queueSweep() {
    if (sweepQueued || IS_CHECKOUT) return;
    sweepQueued = true;
    requestAnimationFrame(function () { sweepQueued = false; sweep(); });
  }

  /* ---------- rates ---------- */
  function loadRates() {
    return fetch('/api/fx', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.rates) { state.rates = d.rates; state.at = d.at; state.stale = !!d.stale; }
        return state.rates;
      })
      .catch(function () { return null; });
  }

  /* ---------- public API ---------- */
  var api = {
    get code() { return state.code; },
    get rates() { return state.rates; },
    get at() { return state.at; },
    get stale() { return state.stale; },
    get country() { return state.country; },
    list: function () { return ORDER.map(function (c) { return { code: c, sym: CUR[c].sym, name: CUR[c].name }; }); },
    convert: convert,
    format: format,
    approx: approx,
    isIndia: function () { return state.country === 'IN' || state.country === null; },
    set: function (code, src) {
      if (!CUR[code]) return;
      state.code = code;
      ls.set(STORE_CUR, code);
      ls.set(STORE_SRC, src || 'user');
      var go = function () {
        paint(document);
        window.dispatchEvent(new CustomEvent('xanvor:currency-change', { detail: { code: code } }));
      };
      if (code !== 'INR' && !state.rates) loadRates().then(go); else go();
    },
    refresh: queueSweep
  };
  window.XanvorMoney = api;

  /* ---------- geo (offer only — never switch silently) ---------- */
  function loadGeo() {
    var cached = null;
    try { cached = JSON.parse(ls.get(STORE_GEO) || 'null'); } catch (e) { /* ignore */ }
    if (cached && cached.c && (Date.now() - cached.at) < 30 * 24 * 3600 * 1000) {
      state.country = cached.c;
      return Promise.resolve(cached.c);
    }
    return fetch('/api/geo', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c = (d && d.country) || '';
        if (c) { state.country = c; ls.set(STORE_GEO, JSON.stringify({ c: c, at: Date.now() })); }
        return c;
      })
      .catch(function () {
        /* offline fallback: timezone is a weak but free signal */
        try {
          var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
          if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') state.country = 'IN';
        } catch (e) { /* ignore */ }
        return state.country || '';
      });
  }

  function maybeOffer() {
    if (ls.get(STORE_OFF) === '1' || ls.get(STORE_CUR)) return;
    var c = state.country;
    if (!c || c === 'IN') return;
    var suggest = GEO_CUR[c] || 'USD';
    if (!CUR[suggest]) return;
    ls.set(STORE_OFF, '1');

    var bar = document.createElement('div');
    bar.className = 'xv-cur-offer';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '<span>Prices are in ₹ INR. Want to see them in <b>' + suggest + '</b> as well?</span>' +
      '<button type="button" class="xv-cur-yes">Show ' + suggest + '</button>' +
      '<button type="button" class="xv-cur-no" aria-label="Dismiss">No thanks</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add('in'); });
    bar.querySelector('.xv-cur-yes').addEventListener('click', function () {
      api.set(suggest, 'suggested'); bar.remove();
    });
    bar.querySelector('.xv-cur-no').addEventListener('click', function () { bar.remove(); });
    setTimeout(function () { if (bar.isConnected) bar.classList.remove('in'); }, 16000);
  }

  /* ---------- boot ---------- */
  function boot() {
    var saved = ls.get(STORE_CUR);
    if (saved && CUR[saved]) state.code = saved;

    sweep();
    /* catch every later render: cart drawer, PDP qty updates, catalogue
       enhancer, checkout summary re-renders. Debounced + re-entrancy-guarded
       so our own writes can't loop. */
    if (!IS_CHECKOUT && window.MutationObserver) {
      new MutationObserver(function () { queueSweep(); })
        .observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    if (state.code !== 'INR') loadRates().then(function () { paint(document); });

    loadGeo().then(function () {
      window.dispatchEvent(new CustomEvent('xanvor:geo-ready', { detail: { country: state.country } }));
      if (state.code === 'INR') setTimeout(maybeOffer, 1400);
    });

    /* another tab changed the preference */
    window.addEventListener('storage', function (e) {
      if (e.key === STORE_CUR && e.newValue && CUR[e.newValue]) {
        state.code = e.newValue;
        if (state.code !== 'INR' && !state.rates) loadRates().then(function () { paint(document); });
        else paint(document);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ============================================================
   XANVOR — first-party visit tracker + welcome-offer capture.
   Loaded on every page by site-chrome.js.

   Tracking: a per-tab session id (sessionStorage) and a long-lived
   visitor id (localStorage) are beaconed to /api/track on each page
   view, on a 60s heartbeat (so admin can show "on site now") and on
   cart/checkout events. No third-party scripts, no IP stored — geo
   comes from Netlify's edge.

   Offer: after 30s of browsing (or on exit intent) a one-time popup
   offers ₹200 off for an email + optional WhatsApp number, and hands
   back the real coupon code that /api/coupon honours at checkout.
   ============================================================ */
(function () {
  if (window.__xvVisit) return;
  window.__xvVisit = true;

  var API_TRACK = '/api/track';
  var API_LEAD = '/api/lead';
  var LS_VID = 'xv_vid';
  var LS_VISITS = 'xv_visits';
  var LS_OFFER = 'xv_offer_v1';       // 'done' once claimed/dismissed
  var SS_SID = 'xv_sid';
  var OFFER_DELAY_MS = 30000;
  var HEARTBEAT_MS = 60000;

  /* ---------- ids ---------- */
  function rid() {
    try {
      var a = new Uint8Array(9); crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    } catch (e) { return String(Date.now()) + Math.random().toString(36).slice(2, 8); }
  }
  function store(kind, key, val) {
    try {
      var s = kind === 'ss' ? sessionStorage : localStorage;
      if (val === undefined) return s.getItem(key);
      s.setItem(key, val); return val;
    } catch (e) { return null; }   // private mode / blocked storage
  }

  var sid = store('ss', SS_SID) || store('ss', SS_SID, rid());
  var vid = store('ls', LS_VID) || store('ls', LS_VID, rid());
  var isNewSession = !window.__xvSessionCounted;
  var visits = parseInt(store('ls', LS_VISITS) || '0', 10) || 0;
  if (isNewSession && !store('ss', 'xv_counted')) {
    visits += 1; store('ls', LS_VISITS, String(visits)); store('ss', 'xv_counted', '1');
  }
  window.__xvSessionCounted = true;

  /* ---------- beacon ---------- */
  function send(payload, useBeacon) {
    payload.sid = sid; payload.vid = vid; payload.visits = visits;
    var body = JSON.stringify(payload);
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(API_TRACK, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        return;
      }
    } catch (e) { /* fall through to fetch */ }
    try {
      fetch(API_TRACK, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* never break the page */ }
  }

  function utmParams() {
    var out = {};
    try {
      var p = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'gclid'].forEach(function (k) {
        var v = p.get(k); if (v) out[k.replace('utm_', '')] = String(v).slice(0, 80);
      });
    } catch (e) {}
    return out;
  }

  function refHost() {
    try {
      if (!document.referrer) return 'direct';
      var h = new URL(document.referrer).hostname;
      return (h && h !== location.hostname) ? h : 'internal';
    } catch (e) { return 'direct'; }
  }

  var pagePath = location.pathname + (location.search ? location.search.slice(0, 120) : '');
  send({ kind: 'view', path: pagePath, title: (document.title || '').slice(0, 140), ref: refHost(), utm: utmParams() });

  /* heartbeat + a final ping when the tab goes away, so "live now" is honest */
  var beat = setInterval(function () {
    if (document.visibilityState === 'visible') send({ kind: 'ping', path: pagePath });
  }, HEARTBEAT_MS);
  window.addEventListener('pagehide', function () { clearInterval(beat); send({ kind: 'ping', path: pagePath }, true); });

  /* ---------- named events ---------- */
  window.xvTrack = function (event, meta) { send({ kind: 'event', event: event, meta: meta, path: pagePath }); };
  window.addEventListener('xanvor:cart-change', function () {
    try {
      var S = window.XanvorShop; if (!S) return;
      var n = S.count();
      if (n > (window.__xvLastCart || 0)) window.xvTrack('add_to_cart', { items: n, value: S.subtotal() });
      window.__xvLastCart = n;
    } catch (e) {}
  });
  if (/checkout/.test(location.pathname)) window.xvTrack('checkout_view');

  /* ---------- welcome offer ---------- */
  function offerDone() { return store('ls', LS_OFFER) === 'done'; }
  function markOfferDone() { store('ls', LS_OFFER, 'done'); }

  var css = ''
    + '.xv-off-scrim{position:fixed;inset:0;z-index:9600;background:rgba(36,21,16,.55);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .3s ease;}'
    + '.xv-off-scrim[data-open="true"]{opacity:1;pointer-events:auto;}'
    + '.xv-off{position:fixed;z-index:9700;left:50%;top:50%;transform:translate(-50%,-46%) scale(.97);opacity:0;pointer-events:none;'
    + 'width:min(420px,92vw);background:#FCFAF4;border:1px solid #D8CBB0;border-radius:14px;box-shadow:0 30px 80px -20px rgba(36,21,16,.5);'
    + 'font-family:var(--xv-body,Jost,Inter,system-ui,sans-serif);color:#241510;transition:opacity .3s ease,transform .3s cubic-bezier(.2,.7,.2,1);overflow:hidden;}'
    + '.xv-off[data-open="true"]{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1);}'
    + '.xv-off-head{background:#241510;padding:20px 24px 18px;text-align:center;}'
    + '.xv-off-head .e{font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif);font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:#C9A57E;}'
    + '.xv-off-head h3{font-family:var(--xv-display,Cormorant Garamond,Georgia,serif);font-weight:400;font-size:25px;color:#FBF6E8;margin:7px 0 0;line-height:1.2;}'
    + '.xv-off-head h3 em{font-style:italic;color:#DCAB60;}'
    + '.xv-off-body{padding:20px 24px 22px;}'
    + '.xv-off-body p{font-size:16px;line-height:1.5;color:#5A4636;margin:0 0 15px;}'
    + '.xv-off input{width:100%;background:#fff;color:#241510;border:1px solid #D8CBB0;border-radius:7px;padding:12px 13px;'
    + 'font-family:inherit;font-size:16px;margin-bottom:9px;}'
    + '.xv-off input:focus{outline:none;border-color:#A85D2A;}'
    + '.xv-off button.go{width:100%;margin-top:5px;background:#A85D2A;color:#FBF6E8;border:none;border-radius:50px;padding:14px;'
    + 'font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif);font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s;}'
    + '.xv-off button.go:hover{background:#C0712F;}'
    + '.xv-off button.go[disabled]{opacity:.6;cursor:default;}'
    + '.xv-off .fine{font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif);font-size:8.5px;letter-spacing:.1em;color:#9A8E7C;text-align:center;margin-top:12px;line-height:1.7;text-transform:uppercase;}'
    + '.xv-off .err{font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif);font-size:10.5px;color:#A32D2D;margin:2px 0 8px;}'
    + '.xv-off .x{position:absolute;top:11px;right:13px;width:30px;height:30px;border:none;border-radius:50%;background:rgba(251,246,232,.12);'
    + 'color:#FBF6E8;font-size:15px;line-height:1;cursor:pointer;}'
    + '.xv-off .x:hover{background:rgba(251,246,232,.24);}'
    + '.xv-off .code{font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif);font-size:23px;letter-spacing:.16em;color:#A85D2A;background:#F8F2E6;'
    + 'border:1px dashed #D8CBB0;border-radius:9px;padding:15px;text-align:center;margin:4px 0 12px;}'
    + '.xv-off .ok{text-align:center;}'
    + '.xv-off .ok .tick{width:52px;height:52px;border-radius:50%;background:#1F8A5B;color:#fff;font-size:26px;line-height:52px;margin:0 auto 12px;}';

  var scrim, modal, mounted = false;

  function mount() {
    if (mounted) return;
    mounted = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    scrim = document.createElement('div'); scrim.className = 'xv-off-scrim';
    modal = document.createElement('div'); modal.className = 'xv-off'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Welcome offer'); modal.setAttribute('data-xv-nomoney','');
    modal.innerHTML = ''
      + '<div class="xv-off-head">'
      + '  <button class="x" type="button" aria-label="Close">✕</button>'
      + '  <div class="e">Welcome to XANVOR</div>'
      + '  <h3>Get <em>₹200 off</em> your first order</h3>'
      + '</div>'
      + '<div class="xv-off-body" id="xvOffBody">'
      + '  <p>Handcrafted brass &amp; kansa from Moradabad. Drop your email and we\'ll send your code — plus first look at new collections.</p>'
      + '  <div class="err" id="xvOffErr" style="display:none"></div>'
      + '  <input id="xvOffEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com">'
      + '  <input id="xvOffPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="WhatsApp number (optional)">'
      + '  <button class="go" type="button" id="xvOffGo">Send me the code</button>'
      + '  <div class="fine">Min order ₹1,499 · No spam, unsubscribe anytime</div>'
      + '</div>';
    document.body.appendChild(scrim); document.body.appendChild(modal);

    scrim.addEventListener('click', close);
    modal.querySelector('.x').addEventListener('click', close);
    modal.querySelector('#xvOffGo').addEventListener('click', submit);
    modal.querySelector('#xvOffEmail').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    modal.querySelector('#xvOffPhone').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.dataset.open === 'true') close(); });
  }

  function open() {
    if (offerDone()) return;
    mount();
    scrim.dataset.open = 'true'; modal.dataset.open = 'true';
    window.xvTrack('offer_shown');
  }
  function close() {
    if (!modal) return;
    scrim.dataset.open = 'false'; modal.dataset.open = 'false';
    markOfferDone();                       // don't nag on the next page
    window.xvTrack('offer_dismissed');
  }

  function submit() {
    var emailEl = modal.querySelector('#xvOffEmail');
    var phoneEl = modal.querySelector('#xvOffPhone');
    var errEl = modal.querySelector('#xvOffErr');
    var btn = modal.querySelector('#xvOffGo');
    var email = (emailEl.value || '').trim();
    var phone = (phoneEl.value || '').trim();

    function fail(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
    if (!email && !phone) return fail('Email ya WhatsApp number daalein');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Sahi email daalein');
    if (phone && (phone.replace(/\D/g, '').length < 10)) return fail('Sahi WhatsApp number daalein');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Sending…';

    var pages = [];
    try { pages = [pagePath]; } catch (e) {}

    fetch(API_LEAD, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, phone: phone, sid: sid, pages: pages, source: 'offer-popup' })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || 'failed');
      markOfferDone();
      modal.querySelector('#xvOffBody').innerHTML = ''
        + '<div class="ok">'
        + '  <div class="tick">✓</div>'
        + '  <p style="margin-bottom:10px">Here\'s your code — it\'s already active at checkout.</p>'
        + '  <div class="code">' + String(d.coupon || 'WELCOME200') + '</div>'
        + '  <p style="font-size:14.5px;margin:0">₹200 off orders above ₹1,499. We\'ve emailed it to you too.</p>'
        + '</div>';
      window.xvTrack('lead_captured');
      setTimeout(function () { if (modal && modal.dataset.open === 'true') { scrim.dataset.open = 'false'; modal.dataset.open = 'false'; } }, 6000);
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = 'Send me the code';
      fail((err && err.message) || 'Kuch galat ho gaya — dubara try karein');
    });
  }

  /* ---- Export-only: the welcome offer is switched off ----------------------
     This popup offered "₹200 off your first order · min order ₹1,499" and handed
     back a coupon code that /api/coupon honoured AT CHECKOUT. There is no
     checkout any more — Razorpay and the cart are off and RETAIL_IDS is empty
     in netlify/functions/lib/render.mjs — so the code could never be redeemed.
     Promising an export buyer a ₹200 discount off an INR minimum-order value is
     also the wrong offer for a B2B account quoted in USD at MOQ 50+.

     Visit TRACKING above is untouched: /api/track, the visitor id and the
     heartbeat all still run, so admin "on site now" keeps working. Only the
     offer modal is suppressed. Flip this to true (and restore retail) to bring
     it back, or repurpose the modal as a trade price-list / catalogue capture,
     which is the B2B equivalent of this lead magnet.

     Same one-line-switch pattern as shop-cart.js (RETAIL_ENABLED) and
     checkout.html (RETAIL_CHECKOUT_ENABLED). */
  var WELCOME_OFFER_ENABLED = false;

  /* triggers: timed, or exit-intent on desktop — never on checkout/account
     (don't interrupt someone who is already paying) */
  if (WELCOME_OFFER_ENABLED && !offerDone() && !/checkout|account|admin/.test(location.pathname)) {
    setTimeout(open, OFFER_DELAY_MS);
    document.addEventListener('mouseout', function onOut(e) {
      if (e.clientY <= 0 && !e.relatedTarget) { document.removeEventListener('mouseout', onOut); open(); }
    });
  }
})();

/* ============================================================
   XANVOR — Pinterest Tag (pintrk) conversion tracking

   SETUP — one step, then this file goes live:
     Ads Manager → Conversions → Tag manager → copy the Tag ID
     (a ~13-digit number) and paste it into TAG_ID below.

   A Pinterest Tag ID only exists once an ad account has been
   created, so until TAG_ID is filled in this file installs
   nothing and costs one cached request. No other edits needed —
   the <script> tags are already on every page.

   Mirrors assets/google-ads.js: base tag once per page, plus a
   purchase/checkout event that fires at most once per order id.
   ============================================================ */
(function () {
  const TAG_ID = ''; // ← paste the Pinterest Tag ID here, e.g. '2613456789012'

  /* No tag ID yet — stay completely inert. */
  if (!TAG_ID) {
    window.XanvorPinterest = { id: null, configured: false, checkout: function () {} };
    return;
  }

  /* Base Pinterest tag — once per page */
  if (!window.__xvPintrkInstalled) {
    window.__xvPintrkInstalled = true;

    if (!window.pintrk) {
      window.pintrk = function () {
        window.pintrk.queue.push(Array.prototype.slice.call(arguments));
      };
      window.pintrk.queue = [];
      window.pintrk.version = '3.0';

      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://s.pinimg.com/ct/core.js';
      document.head.appendChild(s);
    }

    window.pintrk('load', TAG_ID);
    window.pintrk('page');
  }

  const fired = new Set();

  /**
   * Fire the Pinterest `checkout` conversion once per order id.
   * @param {number|string} value        order total (INR)
   * @param {string}        transactionId unique order id (e.g. XV66977589)
   * @param {number}        [quantity]    line count, when known
   */
  function checkout(value, transactionId, quantity) {
    const oid = String(transactionId || '').trim();
    if (!oid) return;
    if (fired.has(oid)) return;
    try {
      if (sessionStorage.getItem('xv_pin_checkout_' + oid)) return;
    } catch (_) {}

    const v = Number(value);
    const payload = { currency: 'INR', order_id: oid };
    if (Number.isFinite(v) && v > 0) payload.value = Math.round(v * 100) / 100;
    const q = Number(quantity);
    if (Number.isFinite(q) && q > 0) payload.order_quantity = Math.round(q);

    try {
      window.pintrk('track', 'checkout', payload);
      fired.add(oid);
      try { sessionStorage.setItem('xv_pin_checkout_' + oid, '1'); } catch (_) {}
    } catch (e) {
      console.warn('[XANVOR Pinterest] checkout conversion failed', e);
    }
  }

  window.XanvorPinterest = {
    id: TAG_ID,
    configured: true,
    checkout,
  };
})();

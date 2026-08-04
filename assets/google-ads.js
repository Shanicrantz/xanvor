/* ============================================================
   XANVOR — Google Ads (gtag) conversion tracking
   Account: AW-18238118971
   Purchase conversion: AW-18238118971/FU9TCMOkhdMcELu4zvhD
   ============================================================ */
(function () {
  const AW_ID = 'AW-18238118971';

  /* Retail checkout is removed — XANVOR is export/B2B and converts on RFQ, so the
     purchase conversion below can no longer fire. Kept only so a future retail
     restore does not need the label looked up again. */
  const PURCHASE_SEND_TO = 'AW-18238118971/FU9TCMOkhdMcELu4zvhD';

  /* RFQ submitted — the real conversion for a B2B account.
     Conversion action "RFQ Submitted" (goal: Submit lead form), created
     2026-08-03 in account 788-843-7347. Primary action, count = One,
     90-day click-through window, data-driven attribution.
     Its configured default is 1.0 INR, used whenever we send no explicit value. */
  const LEAD_SEND_TO = 'AW-18238118971/dENbCOGH_tocELu4zvhD';

  // Base Google tag — once per page
  if (!window.__xvGtagInstalled) {
    window.__xvGtagInstalled = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AW_ID;
    document.head.appendChild(s);

    window.gtag('js', new Date());
    window.gtag('config', AW_ID);
  }

  const fired = new Set();

  /**
   * Fire Purchase conversion once per order id.
   * @param {number|string} value  order total (INR)
   * @param {string} transactionId unique order id (e.g. XV66977589)
   */
  function purchase(value, transactionId) {
    const oid = String(transactionId || '').trim();
    if (!oid) return;
    if (fired.has(oid)) return;
    try {
      if (sessionStorage.getItem('xv_ads_purchase_' + oid)) return;
    } catch (_) {}

    const v = Number(value);
    const payload = {
      send_to: PURCHASE_SEND_TO,
      currency: 'INR',
      transaction_id: oid,
    };
    if (Number.isFinite(v) && v > 0) payload.value = Math.round(v * 100) / 100;

    try {
      window.gtag('event', 'conversion', payload);
      fired.add(oid);
      try { sessionStorage.setItem('xv_ads_purchase_' + oid, '1'); } catch (_) {}
    } catch (e) {
      console.warn('[XANVOR Ads] purchase conversion failed', e);
    }
  }

  /**
   * Fire the RFQ (lead) conversion once per enquiry reference.
   * @param {string} rid    RFQ reference returned by /api/rfq
   * @param {number} [value] indicative enquiry value; omit if unknown
   * @param {string} [currency] defaults to USD — XANVOR quotes export in USD
   */
  function lead(rid, value, currency) {
    if (!LEAD_SEND_TO) return;            // conversion action not created yet
    const key = String(rid || '').trim();
    if (!key || fired.has('lead:' + key)) return;
    try {
      if (sessionStorage.getItem('xv_ads_lead_' + key)) return;
    } catch (_) {}

    /* Only send a currency alongside a real value. Sending currency:'USD' with no
       value would contradict the action's 1.0 INR default and make the reported
       figure meaningless. */
    const payload = { send_to: LEAD_SEND_TO, transaction_id: key };
    const v = Number(value);
    if (Number.isFinite(v) && v > 0) {
      payload.value = Math.round(v * 100) / 100;
      payload.currency = currency || 'USD';
    }

    try {
      window.gtag('event', 'conversion', payload);
      fired.add('lead:' + key);
      try { sessionStorage.setItem('xv_ads_lead_' + key, '1'); } catch (_) {}
    } catch (e) {
      console.warn('[XANVOR Ads] lead conversion failed', e);
    }
  }

  window.XanvorAds = {
    id: AW_ID,
    purchaseSendTo: PURCHASE_SEND_TO,
    leadSendTo: LEAD_SEND_TO,
    purchase,
    lead,
  };
})();

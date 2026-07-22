/* ============================================================
   XANVOR — Google Ads (gtag) conversion tracking
   Account: AW-18238118971
   Purchase conversion: AW-18238118971/FU9TCMOkhdMcELu4zvhD
   ============================================================ */
(function () {
  const AW_ID = 'AW-18238118971';
  const PURCHASE_SEND_TO = 'AW-18238118971/FU9TCMOkhdMcELu4zvhD';

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

  window.XanvorAds = {
    id: AW_ID,
    purchaseSendTo: PURCHASE_SEND_TO,
    purchase,
  };
})();

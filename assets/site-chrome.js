/* ============================================================
   XANVOR — site chrome: unified nav, collections menu, mobile drawer
   Safe with shop-cart.js + account.js (they append into nav .links).
   ============================================================ */
(function () {
  const COLLECTIONS = [
    { num: 'I',   name: 'Silver & Gold',        sub: 'Trays · bowls · jar sets',       href: '#c-silvergold', homeOnly: true },
    { num: 'II',  name: 'Copper',               sub: 'Drinkware & bar',                href: '#c-copper', homeOnly: true },
    { num: 'III', name: 'Brass',                sub: 'Singing bowls & heritage',       href: '#c-brass', homeOnly: true },
    { num: 'IV',  name: 'Sheesham & Wood',      sub: 'Trays & spice boxes',            href: '#c-wood', homeOnly: true },
    { num: 'V',   name: 'Wireform Furniture',   sub: 'Baskets · tables · seating',     href: '#c-furniture', homeOnly: true },
    { num: 'VI',  name: 'Serving Trays',        sub: 'Brass · gemstone handles',       href: '#c-trays', homeOnly: true },
    { num: 'VII', name: 'Copper Home',          sub: 'Trays · bowls · chargers',       href: '#c-copperhome', homeOnly: true },
    { num: 'VIII',name: 'The Jewel Collection', sub: 'Gemstone-set brass',             href: '#c-jewel', homeOnly: true },
    { num: 'IX',  name: 'Canisters & Vanity',   sub: 'Jars · boxes · canisters',       href: '#c-canister', homeOnly: true },
    { num: 'X',   name: 'Ribbed Storage',       sub: 'Bronze · gold · silver cases',   href: '#c-ribbed', homeOnly: true },
    { num: 'XI',  name: 'Metal Wall Art',       sub: 'Wall panels · mirrors · décor',  href: '#c-wallart', homeOnly: true },
    { num: 'XII', name: 'Kansa Dinnerware',     sub: 'Bronze thalis · katoris',        href: '#c-kansa', homeOnly: true },
    /* sub was 'Wire · sheet · mass retail' — on an export-only site that reads as
       XANVOR selling retail. It meant volume/high-quantity lines. */
    { num: 'XIII',name: 'Kitchen Utilities',    sub: 'Wire · sheet · volume lines',    href: '#c-utility', homeOnly: true },
    /* Hot-Serve sits last by request. It is the only collection with its own page
       rather than an on-page #c-… band, so the numbering of the thirteen on-page
       groups is now unbroken I–XIII and this one closes the list at XIV.
       ORDER IS MIRRORED IN index.html: the nav dropdown, the #collections tiles,
       the .cat-jump rail and each .cat-group's <span class="num">. */
    { num: 'XIV', name: 'Hot-Serve',            sub: 'Warmers · hot-pots · domes',     href: 'Hot-Serve Collection.html', badge: 'New' },
  ];

  function isHome() {
    const path = location.pathname || '/';
    const file = (path.split('/').pop() || '').toLowerCase();
    // root, trailing slash, index.html, or empty filename
    return file === '' || file === 'index.html' || path === '/' || /\/$/.test(path);
  }

  function resolveHref(href) {
    if (!href) return '#';
    if (href.startsWith('http') || href.endsWith('.html')) return href;
    if (href.startsWith('#')) return isHome() ? href : ('index.html' + href);
    return href;
  }

  function pageKey() {
    const f = (location.pathname.split('/').pop() || 'index.html').toLowerCase() || 'index.html';
    if (!f || f === '') return 'index.html';
    return f;
  }

  function chevSvg() {
    return '<svg class="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
  }

  function menuItemsHtml() {
    return COLLECTIONS.map(c => {
      const href = resolveHref(c.href);
      const badge = c.badge ? `<span class="cm-badge">${c.badge}</span>` : '';
      return `<a role="menuitem" href="${href}"${c.badge ? ' class="cm-new"' : ''}>
        <span class="cm-num">${c.num}</span>
        <span class="cm-t"><b>${c.name}</b><span>${c.sub}</span></span>
        ${badge}
      </a>`;
    }).join('');
  }

  function drawerCollectionsHtml() {
    return COLLECTIONS.map(c => {
      const href = resolveHref(c.href);
      return `<a href="${href}">${c.name}</a>`;
    }).join('');
  }

  function buildNavHtml() {
    const home = isHome();
    const brandHref = home ? '#top' : 'index.html';
    const shopHref = 'all-products.html';
    /* The homepage now carries its own #about band, so on home the nav scrolls
       to it the way Contact already did, instead of leaving the page. */
    const aboutHref = home ? '#about' : 'about.html';
    const contactHref = home ? '#contact' : 'contact.html';
    const pk = pageKey();

    const active = (keys) => keys.includes(pk) ? ' xv-active' : '';

    return `
      <a href="${brandHref}" class="brand">XANVOR</a>
      <div class="links" id="xvNavLinks">
        <a class="xv-desktop-only${active(['all-products.html'])}" href="${shopHref}">Products</a>
        <div class="nav-cat xv-desktop-only" id="navCat">
          <button class="nav-cat-btn" type="button" aria-haspopup="true" aria-expanded="false">
            Collections ${chevSvg()}
          </button>
          <div class="cat-menu" role="menu">
            <div class="cm-h">The Collections</div>
            ${menuItemsHtml()}
            <a role="menuitem" href="${shopHref}" style="margin-top:4px;border-top:1px solid var(--xv-line,#E6DCC8);border-radius:0 0 8px 8px;">
              <span class="cm-num">+</span>
              <span class="cm-t"><b>View all products</b><span>Full catalogue</span></span>
            </a>
          </div>
        </div>
        <a class="xv-desktop-only${active(['tideline.html'])}" href="tideline.html">Tideline</a>
        <a class="xv-desktop-only${active(['new-designs.html'])}" href="new-designs.html">New designs</a>
        <a class="xv-desktop-only${active(['wholesale.html', 'oem-odm.html', 'faq.html'])}" href="wholesale.html">Wholesale</a>
        <a class="xv-desktop-only${active(['about.html'])}" href="${aboutHref}">About</a>
        <a class="xv-desktop-only${active(['contact.html'])}" href="${contactHref}">Contact</a>
        <button type="button" class="xv-cur" id="xvCur" aria-haspopup="dialog" aria-expanded="false"
                aria-label="Show prices in another currency">
          <span id="xvCurLbl">₹ INR</span>
          <svg class="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>
        </button>
        <a class="xv-quote xv-desktop-only" href="wholesale.html#rfq">Request a Quote &rarr;</a>
      </div>
      <button type="button" class="xv-burger" id="xvBurger" aria-label="Open menu" aria-expanded="false">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M3 5h14M3 10h14M3 15h14"/>
        </svg>
      </button>`;
  }

  /* The homepage is a single-page narrative (about → collections → products →
     lookbook → craft → finishes → quality → markets → catalogue → contact), and
     the top nav has no room left for nine more links. On mobile the drawer is
     the only navigation, so the section index lives there — home only, because
     these anchors resolve to index.html#… noise on every other page. */
  const HOME_SECTIONS = [
    ['#tideline', 'TIDELINE range'],
    ['#about', 'About XANVOR'],
    ['#collections', 'The collections'],
    ['#lookbook', 'Lookbook'],
    ['#craft', 'The craft'],
    ['#finishes', 'Finishes'],
    ['#quality', 'Quality'],
    ['#markets', 'Markets & terms'],
    ['#catalogue', 'Full catalogue'],
    ['#contact', 'Trade desk'],
  ];
  function drawerSectionsHtml() {
    if (!isHome()) return '';
    return '<div class="xv-drawer-sec">On this page</div>'
      + '<div class="xv-drawer-sub">'
      + HOME_SECTIONS.map(function (s) { return '<a href="' + s[0] + '">' + s[1] + '</a>'; }).join('')
      + '</div>';
  }

  function ensureDrawer() {
    if (document.getElementById('xvDrawer')) return;
    const scrim = document.createElement('div');
    scrim.className = 'xv-drawer-scrim';
    scrim.id = 'xvDrawerScrim';
    const drawer = document.createElement('aside');
    drawer.className = 'xv-drawer';
    drawer.id = 'xvDrawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="xv-drawer-head">
        <div class="t">XANVOR</div>
        <button type="button" class="xv-drawer-close" id="xvDrawerClose" aria-label="Close menu">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>
        </button>
      </div>
      <div class="xv-drawer-body">
        <a href="all-products.html">All products</a>
        <!-- The range page, linked from every page including home. The homepage
             carries the same pieces in its own band, but that band is not a
             destination anyone can send a buyer to. -->
        <a href="tideline.html">TIDELINE &mdash; the range</a>
        <a href="new-designs.html">New designs</a>
        <a href="wholesale.html">Wholesale &amp; export</a>
        <a href="oem-odm.html">OEM / private label</a>
        <a href="${isHome() ? '#catalogue' : 'index.html#catalogue'}">Catalogue</a>
        <a href="Hot-Serve Collection.html">Hot-Serve</a>
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
        <a href="account.html">Account</a>
        <!-- "Checkout" dropped: checkout.html now hard-redirects to the RFQ form,
             so the link only ever bounced the buyer somewhere else. The quote CTA
             below replaces it as the drawer's primary action. -->
        <a href="wholesale.html#rfq">Request a quote</a>
        <button type="button" class="xv-drawer-cur" id="xvDrawerCur">Show prices in <b id="xvDrawerCurLbl">₹ INR</b></button>
        ${drawerSectionsHtml()}
        <div class="xv-drawer-sec">Collections</div>
        <div class="xv-drawer-sub">${drawerCollectionsHtml()}</div>
      </div>
      <div class="xv-drawer-foot">
        <!-- was "Manufacturer · Exporter · Ecommerce" — the retail cart and
             checkout are off, so the site sells nothing directly. -->
        Manufacturer · Exporter · OEM<br>
        <a href="mailto:hello@xanvor.com">hello@xanvor.com</a>
      </div>`;
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);
  }

  function openDrawer() {
    const d = document.getElementById('xvDrawer');
    const s = document.getElementById('xvDrawerScrim');
    const b = document.getElementById('xvBurger');
    if (!d) return;
    d.classList.add('open');
    s && s.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    b && b.setAttribute('aria-expanded', 'true');
    document.body.classList.add('xv-drawer-open');
  }
  function closeDrawer() {
    const d = document.getElementById('xvDrawer');
    const s = document.getElementById('xvDrawerScrim');
    const b = document.getElementById('xvBurger');
    if (!d) return;
    d.classList.remove('open');
    s && s.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    b && b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('xv-drawer-open');
  }

  function wireNavInteractions(nav) {
    const nc = nav.querySelector('#navCat');
    if (nc) {
      const btn = nc.querySelector('.nav-cat-btn');
      if (btn && !btn._xvBound) {
        btn._xvBound = true;
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          const o = nc.classList.toggle('open');
          btn.setAttribute('aria-expanded', o ? 'true' : 'false');
        });
        document.addEventListener('click', function (e) {
          if (!nc.contains(e.target)) {
            nc.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
          }
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            nc.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            closeDrawer();
          }
        });
      }
    }

    const burger = document.getElementById('xvBurger');
    if (burger && !burger._xvBound) {
      burger._xvBound = true;
      burger.addEventListener('click', openDrawer);
    }
    const closeBtn = document.getElementById('xvDrawerClose');
    const scrim = document.getElementById('xvDrawerScrim');
    if (closeBtn && !closeBtn._xvBound) {
      closeBtn._xvBound = true;
      closeBtn.addEventListener('click', closeDrawer);
    }
    if (scrim && !scrim._xvBound) {
      scrim._xvBound = true;
      scrim.addEventListener('click', closeDrawer);
    }
    document.querySelectorAll('#xvDrawer a').forEach(a => {
      a.addEventListener('click', closeDrawer);
    });

    /* The utility strip collapses on real scroll only. It used to key off the
       same flag as the nav's solid state — now that the nav is solid from the
       first pixel, that would have hidden the strip permanently. */
    const onScroll = () => {
      document.documentElement.classList.toggle('xv-scrolled', window.scrollY > 36);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Utility strip above the nav — the standing trade line wbinc.in runs across
     the top of every page. It slides away on scroll (see .xv-scrolled in
     site-chrome.css) so it costs nothing once the buyer is reading.
     Every claim here has to be independently true: the GSTIN is on the seals,
     the MOQ and the one-working-day reply are stated on wholesale.html and
     faq.html. Do NOT add a rating or a founding year — neither is evidenced
     anywhere in this repo. */
  function ensureUtilityBar() {
    if (document.getElementById('xvUtility')) return;
    const bar = document.createElement('div');
    bar.className = 'xv-utility';
    bar.id = 'xvUtility';
    bar.innerHTML =
      '<div class="xv-utility-in">'
      + '<div class="xv-utility-facts">'
      + '<span>Zenko Inc. &middot; GST-registered exporter, Moradabad</span>'
      + '<span class="xv-u-sep">&middot;</span>'
      + '<span>MOQ from 50 pcs &middot; EXW &middot; FOB &middot; CIF &middot; DDP</span>'
      + '<span class="xv-u-sep">&middot;</span>'
      + '<span>Reply within one working day</span>'
      + '</div>'
      + '<a class="xv-utility-cta" href="wholesale.html#rfq">Request a Quote &rarr;</a>'
      + '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.documentElement.classList.add('xv-has-utility');
  }

  function polishFooter() {
    const foot = document.querySelector('body > footer');
    if (!foot) return;
    foot.classList.add('xv-footer');
    if (!foot.querySelector('.f-policy') && !foot.querySelector('[aria-label]')) {
      // bare footer text pages — leave content
      return;
    }
  }

  function mount() {
    document.body.classList.add('xv-has-chrome');
    let nav = document.getElementById('nav') || document.querySelector('body > nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'nav';
      document.body.insertBefore(nav, document.body.firstChild);
    }
    nav.id = 'nav';
    nav.classList.add('xv-nav');

    /* Solid nav everywhere, homepage included. The transparent state was built
       for the ivory brand hero; the homepage now opens on the TIDELINE range
       hero, which is a dark photograph — and the nav's link colour is a dark
       slate, so transparent-over-photo left the whole menu unreadable at
       scroll 0. A solid ivory bar reads on both. */
    nav.classList.add('xv-nav-solid', 'scrolled');
    if (!isHome()) {
      document.body.classList.add('xv-inner-page');
    } else {
      document.body.classList.add('xv-home');
    }

    // Capture cart/account nodes if already present (re-init safety)
    const prevCart = nav.querySelector('.sc-navbtn');
    const prevAc = nav.querySelector('.ac-navbtn');

    nav.innerHTML = buildNavHtml();
    const links = nav.querySelector('.links');
    if (prevCart && links) links.appendChild(prevCart);
    if (prevAc && links) links.appendChild(prevAc);

    ensureUtilityBar();
    ensureDrawer();
    wireNavInteractions(nav);
    polishFooter();
    injectSeals();
    initFloatIn();
    loadCurrency();
    wireCurrency();

    // Signal for other scripts
    window.XanvorChrome = { openDrawer, closeDrawer, isHome: isHome() };
    window.dispatchEvent(new CustomEvent('xanvor:chrome-ready'));
  }

  /* ---- Display-currency switcher ----
     assets/currency.js owns conversion; this owns the control. Loaded as a
     real (deferred) script rather than on idle like visit.js — price
     annotation should land close to first paint, not seconds later. */
  function loadCurrency() {
    if (document.getElementById('xv-currency-js')) return;
    var s = document.createElement('script');
    s.id = 'xv-currency-js';
    s.src = '/assets/currency.js?v=4';
    s.defer = true;
    document.head.appendChild(s);
  }

  function curPanel() {
    var el = document.getElementById('xvCurPanel');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xvCurPanel';
    el.className = 'xv-cur-panel';
    /* the panel explains the rate ("1 USD = ₹96") — without this the sweep
       would annotate its own explainer into "1 USD = ₹96 ≈ $1" */
    el.setAttribute('data-xv-nomoney', '');
    el.setAttribute('tabindex', '-1');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-label', 'Show prices in another currency');
    /* appended to <body>, never inside <nav> — mount() replaces nav.innerHTML
       wholesale, which would destroy anything parked in there */
    document.body.appendChild(el);
    return el;
  }

  /* Per-currency note. Was: INR "Charged at checkout", everything else
     "Estimate only". Nothing is charged at any checkout — the retail cart is
     off and every order settles against a Proforma Invoice. INR is simply the
     currency the catalogue figures are written in; USD is the standard quote
     currency, with EUR / GBP / AED issued on request. The rest of the list
     converts for reading only — we do not quote in them. */
  var QUOTE_NOTE = {
    USD: 'Standard quote currency',
    EUR: 'Quoted on request',
    GBP: 'Quoted on request',
    AED: 'Quoted on request'
  };

  function renderCurPanel() {
    var M = window.XanvorMoney;
    if (!M) return;
    var panel = curPanel();
    var rows = M.list().map(function (c) {
      var on = c.code === M.code;
      var note = c.code === 'INR' ? 'Catalogue currency' : (QUOTE_NOTE[c.code] || 'Indicative conversion');
      return '<button type="button" class="xv-cur-row' + (on ? ' on' : '') + '" data-cur="' + c.code + '">' +
        '<span class="xv-cur-sym">' + c.sym + '</span>' +
        '<span class="xv-cur-nm"><b>' + c.code + '</b> ' + c.name + '</span>' +
        '<span class="xv-cur-note">' + note + '</span></button>';
    }).join('');
    var rateLine = '';
    if (M.rates && M.rates.USD) {
      var when = M.at ? new Date(M.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      rateLine = M.stale
        ? 'Reference rate may be out of date — treat conversions as rough.'
        : 'Reference rate 1 USD = ₹' + Math.round(1 / M.rates.USD) + (when ? ' · updated ' + when : '');
    }
    panel.innerHTML =
      '<div class="xv-cur-head">Show prices in</div>' +
      '<div class="xv-cur-rows">' + rows + '</div>' +
      (rateLine ? '<div class="xv-cur-rate">' + rateLine + '</div>' : '') +
      /* Was "We bill in two currencies only: ₹ INR at retail checkout (India
         delivery), and the currency stated on your Proforma Invoice for export
         orders." The INR-at-checkout rail no longer exists — the retail cart is
         off — so the PI is the only billing currency left. */
      '<div class="xv-cur-foot">We bill in one currency only: the one stated on your ' +
      '<b>Proforma Invoice</b>. Every other figure on this site is an indicative ' +
      'conversion of the catalogue price — not a figure we can invoice.</div>';

    panel.querySelectorAll('[data-cur]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.XanvorMoney.set(b.dataset.cur, 'user');
        closeCur();
      });
    });
  }

  function curLabel() {
    var M = window.XanvorMoney;
    if (!M) return;
    var txt = M.code === 'INR' ? '₹ INR' : '₹ · ' + M.code;
    var a = document.getElementById('xvCurLbl'); if (a) a.textContent = txt;
    var b = document.getElementById('xvDrawerCurLbl'); if (b) b.textContent = txt;
  }

  var curOpener = null;
  function openCur() {
    renderCurPanel();
    var p = curPanel();
    p.classList.add('open');
    var btn = document.getElementById('xvCur');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    /* keyboard users must be able to reach the options — the panel is
       appended at the end of <body>, nowhere near the button in tab order */
    curOpener = document.activeElement;
    var first = p.querySelector('.xv-cur-row');
    (first || p).focus();
    setTimeout(function () { document.addEventListener('click', outsideCur); }, 0);
  }
  function closeCur() {
    var p = document.getElementById('xvCurPanel');
    if (p) p.classList.remove('open');
    var btn = document.getElementById('xvCur');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', outsideCur);
    if (curOpener && curOpener.focus) curOpener.focus();
    curOpener = null;
  }
  function outsideCur(e) {
    var p = document.getElementById('xvCurPanel');
    if (!p || p.contains(e.target) || (e.target.closest && e.target.closest('.xv-cur, .xv-drawer-cur'))) return;
    closeCur();
  }

  function wireCurrency() {
    var toggle = function (e) {
      e.preventDefault(); e.stopPropagation();
      var p = document.getElementById('xvCurPanel');
      if (p && p.classList.contains('open')) closeCur(); else openCur();
    };
    var nb = document.getElementById('xvCur');
    if (nb) nb.addEventListener('click', toggle);
    var db = document.getElementById('xvDrawerCur');
    if (db) db.addEventListener('click', function (e) { closeDrawer(); toggle(e); });
    document.addEventListener('keydown', function (e) {
      var p = document.getElementById('xvCurPanel');
      if (e.key === 'Escape' && p && p.classList.contains('open')) { closeCur(); e.stopPropagation(); }
    });
    window.addEventListener('xanvor:currency-change', function () { curLabel(); renderCurPanel(); });
    /* currency.js may finish booting after us */
    setTimeout(curLabel, 300);
    setTimeout(curLabel, 1500);
  }

  /* Trust seals — WB-style chip row at the top of every footer. Only honest,
     verifiable claims: registrations, process guarantees, payment rails.
     (WB Inc's IEC/EPCH/SGS seals belong to WB Inc, not Zenko — do not copy.) */
  var SEALS = [
    ['❖', 'GST Registered', 'GSTIN 09AAEFZ4419L1ZN'],
    ['❖', 'Zenko Inc.', 'Registered Partnership · Moradabad'],
    ['❖', '100% Handmade', 'No machine look'],
    ['❖', 'QC Approval', 'Pre-dispatch photo & video'],
    ['❖', 'Export Packing', 'EPE foam + master cartons'],
    /* Was "Secure Checkout · Razorpay · UPI · Cards". Razorpay and the retail
       cart are off (RETAIL_IDS empty in render.mjs), so this seal appeared in
       every page footer advertising a payment rail that no longer exists. */
    ['❖', 'Export Terms', 'EXW · FOB · CIF · DDP'],
  ];
  function sealsHtml() {
    return SEALS.map(function (s) {
      return '<span class="xv-seal"><span class="xs-i">' + s[0] + '</span><b>' + s[1] + '</b> ' + s[2] + '</span>';
    }).join('');
  }
  function injectSeals() {
    /* Plain `footer`, not `body > footer`. index.html's #catalogue section is
       now properly closed so the homepage footer IS a direct body child, but
       other pages nest theirs — this selector works for both. */
    var footer = document.querySelector('footer');
    if (!footer || footer.querySelector('.xv-seals')) return;
    var row = document.createElement('div');
    row.className = 'xv-seals';
    row.setAttribute('aria-label', 'Trust and registration seals');
    row.innerHTML = sealsHtml();
    footer.insertBefore(row, footer.firstChild);
  }

  /* Scroll-float: card grids drift up into place (staggered) as they enter
     the viewport — INCLUDING the homepage catalogue cards. This page has a
     history of stalled CSS transitions, so instead of trusting them we keep
     perpetual safety sweeps (interval + scroll) that instantly force-show
     any card that should be visible but isn't: never-revealed cards already
     inside the viewport, and the classic frozen-mid-transition case. Cards
     still below the fold keep their animation for whenever the user gets
     there — no global "give up" timer that strips the effect. */
  function initFloatIn() {
    try {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!('IntersectionObserver' in window)) return;
      var SEL = ['.featured-grid > *', '.trust-wrap > .t-cell', '.ndband-grid > *',
                 '.tb-grid > *', '.nd-grid > *', '.ws-cols > *', '.cap-grid > *',
                 '.faq-list details', 'a.card', '.cat-grid > .cat-item'].join(',');
      var els = Array.prototype.slice.call(document.querySelectorAll(SEL));
      if (!els.length) return;
      els.forEach(function (el) {
        var i = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = ((i % 6) * 70) + 'ms';
        el.classList.add('xv-float');
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.dataset.xvInAt = String(Date.now());
            en.target.classList.add('xv-in');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px -30px 0px' });
      els.forEach(function (el) { io.observe(el); });

      /* stagger (≤350ms) + duration (700ms) — anything older than this that
         is still faded is genuinely frozen, not animating */
      var SETTLE_MS = 1600;
      function sweep() {
        document.querySelectorAll('.xv-float').forEach(function (el) {
          var isIn = el.classList.contains('xv-in');
          var r = el.getBoundingClientRect();
          var inView = r.top < window.innerHeight + 100 && r.bottom > -100;
          var age = Date.now() - (parseInt(el.dataset.xvInAt, 10) || 0);
          var stuck = isIn && inView && age > SETTLE_MS
            && parseFloat(getComputedStyle(el).opacity) < 0.9;
          if ((!isIn && inView) || stuck) {
            el.style.setProperty('transition', 'none', 'important');
            el.style.transitionDelay = '';
            el.dataset.xvInAt = String(Date.now());
            el.classList.add('xv-in');
          }
        });
      }
      setInterval(sweep, 4000);
      var sweepQueued = false;
      window.addEventListener('scroll', function () {
        if (sweepQueued) return;
        sweepQueued = true;
        setTimeout(function () { sweepQueued = false; sweep(); }, 450);
      }, { passive: true });
    } catch (e) { /* animation is optional — never break the page for it */ }
  }

  /* First-party visit tracker + welcome-offer popup. Loaded from here so it
     lands on every page that has the shared chrome, without 12 more script
     tags. Deferred to idle time — it must never compete with page render. */
  function loadVisitTracker() {
    if (document.getElementById('xv-visit-js')) return;
    var s = document.createElement('script');
    s.id = 'xv-visit-js';
    s.src = '/assets/visit.js?v=4';   /* absolute — /checkout has no dir base */
    s.async = true;
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  if (window.requestIdleCallback) requestIdleCallback(loadVisitTracker, { timeout: 3000 });
  else setTimeout(loadVisitTracker, 1200);
})();

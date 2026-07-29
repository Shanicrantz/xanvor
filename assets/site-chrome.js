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
    { num: 'VI',  name: 'Hot-Serve',            sub: 'Warmers · hot-pots · domes',     href: 'Hot-Serve Collection.html', badge: 'New' },
    { num: 'VII', name: 'Serving Trays',        sub: 'Brass · gemstone handles',       href: '#c-trays', homeOnly: true },
    { num: 'VIII',name: 'Copper Home',          sub: 'Trays · bowls · chargers',       href: '#c-copperhome', homeOnly: true },
    { num: 'IX',  name: 'The Jewel Collection', sub: 'Gemstone-set brass',             href: '#c-jewel', homeOnly: true },
    { num: 'X',   name: 'Canisters & Vanity',   sub: 'Jars · boxes · canisters',       href: '#c-canister', homeOnly: true },
    { num: 'XI',  name: 'Ribbed Storage',       sub: 'Bronze · gold · silver cases',   href: '#c-ribbed', homeOnly: true },
    { num: 'XII', name: 'Metal Wall Art',       sub: 'Wall panels · mirrors · décor',  href: '#c-wallart', homeOnly: true },
    { num: 'XIII',name: 'Kansa Dinnerware',     sub: 'Bronze thalis · katoris',        href: '#c-kansa', homeOnly: true },
    { num: 'XIV', name: 'Kitchen Utilities',    sub: 'Wire · sheet · mass retail',     href: '#c-utility', homeOnly: true },
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
    const aboutHref = 'about.html';
    const contactHref = home ? '#contact' : 'contact.html';
    const pk = pageKey();

    const active = (keys) => keys.includes(pk) ? ' xv-active' : '';

    return `
      <a href="${brandHref}" class="brand">XANVOR</a>
      <div class="links" id="xvNavLinks">
        <a class="xv-desktop-only${active(['all-products.html'])}" href="${shopHref}">Shop</a>
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
        <a class="xv-desktop-only${active(['new-designs.html'])}" href="new-designs.html">New designs</a>
        <a class="xv-desktop-only${active(['wholesale.html', 'oem-odm.html', 'faq.html'])}" href="wholesale.html">Wholesale</a>
        <a class="xv-desktop-only${active(['about.html'])}" href="${aboutHref}">About</a>
        <a class="xv-desktop-only${active(['contact.html'])}" href="${contactHref}">Contact</a>
      </div>
      <button type="button" class="xv-burger" id="xvBurger" aria-label="Open menu" aria-expanded="false">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M3 5h14M3 10h14M3 15h14"/>
        </svg>
      </button>`;
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
        <a href="all-products.html">Shop all</a>
        <a href="new-designs.html">New designs</a>
        <a href="wholesale.html">Wholesale &amp; export</a>
        <a href="oem-odm.html">OEM / private label</a>
        <a href="${isHome() ? '#catalogue' : 'index.html#catalogue'}">Catalogue</a>
        <a href="Hot-Serve Collection.html">Hot-Serve</a>
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
        <a href="account.html">Account</a>
        <a href="checkout.html">Checkout</a>
        <div class="xv-drawer-sec">Collections</div>
        <div class="xv-drawer-sub">${drawerCollectionsHtml()}</div>
      </div>
      <div class="xv-drawer-foot">
        Manufacturer · Exporter · Ecommerce<br>
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

    // scroll state
    const onScroll = () => {
      const solid = nav.classList.contains('xv-nav-solid');
      nav.classList.toggle('scrolled', solid || window.scrollY > 36);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
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

    // Solid nav on non-hero pages (everything except homepage)
    if (!isHome()) {
      nav.classList.add('xv-nav-solid', 'scrolled');
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

    ensureDrawer();
    wireNavInteractions(nav);
    polishFooter();
    injectSeals();
    initFloatIn();

    // Signal for other scripts
    window.XanvorChrome = { openDrawer, closeDrawer, isHome: isHome() };
    window.dispatchEvent(new CustomEvent('xanvor:chrome-ready'));
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
    ['❖', 'Secure Checkout', 'Razorpay · UPI · Cards'],
  ];
  function sealsHtml() {
    return SEALS.map(function (s) {
      return '<span class="xv-seal"><span class="xs-i">' + s[0] + '</span><b>' + s[1] + '</b> ' + s[2] + '</span>';
    }).join('');
  }
  function injectSeals() {
    /* NOT `body > footer` — index.html's #catalogue section is never closed,
       so the homepage footer parses INSIDE it, not as a direct body child */
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
    s.src = '/assets/visit.js?v=1';   /* absolute — /checkout has no dir base */
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

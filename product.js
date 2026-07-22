/* ============================================================
   XANVOR product page — render + B2B bulk quote calculator
   ============================================================ */
(function(){
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const root = document.getElementById('product-root');
  const all = (window.XANVOR_PRODUCTS || []);
  const product = all.find(p => p.id === id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => '₹' + Number(n).toLocaleString('en-IN');

  /* ---- Bulk-pricing tiers (illustrative; final pricing on enquiry) ---- */
  const TIERS = [
    { id:'s',   q:5,    pct:0,    label:'Sample · 1–49 pcs',          disc:'Standard',         lead:'2–3 weeks',           ship:'Air cargo · DHL/FedEx' },
    { id:'a',   q:50,   pct:0.12, label:'Trial order · 50–199 pcs',   disc:'~12% off sample',  lead:'4–5 weeks',           ship:'FOB · EXW · DDP' },
    { id:'b',   q:200,  pct:0.22, label:'Volume · 200–499 pcs',       disc:'~22% off sample',  lead:'6–7 weeks',           ship:'FOB · EXW · DDP' },
    { id:'c',   q:500,  pct:0.32, label:'Bulk · 500–999 pcs',         disc:'~32% off sample',  lead:'8–10 weeks',          ship:'FOB Mundra / Nhava Sheva' },
    { id:'d',   q:1000, pct:0.40, label:'Container · 1000+ pcs',      disc:'~40% off sample',  lead:'10–12 weeks · split shipment available', ship:'FOB · CIF · DDP' },
  ];
  /* Tier discounts are applied to the trade (offer) price — but "~12% off
     sample" reads weak to a bulk buyer. Where we know MRP, show the discount
     ANCHORED TO MRP instead: unit prices stay identical (no margin given up),
     the headline just tells the truth vs the sticker price — typically 55–75%
     off, which is what actually convinces a 50+ pcs buyer. Fallback for
     pieces without any price: the generic off-sample label. */
  const discLabelFor = (t, product) => {
    if(!t.pct) return t.disc;
    const base = typeof product.offer === 'number' ? product.offer
               : typeof product.retail === 'number' ? product.retail : null;
    if(base && product.mrp){
      const unit = base * (1 - t.pct);
      return '~' + Math.round((1 - unit / product.mrp) * 100) + '% off MRP';
    }
    return t.disc;
  };

  const tierFor = q => {
    if(q < 50)   return TIERS[0];
    if(q < 200)  return TIERS[1];
    if(q < 500)  return TIERS[2];
    if(q < 1000) return TIERS[3];
    return TIERS[4];
  };

  /* ---- Finishes (illustrative; product-agnostic) ---- */
  const FINISHES = [
    { id:'antique',  name:'Antique gold',  hex:'#A87B3F' },
    { id:'polished', name:'Polished',      hex:'#C9A57E' },
    { id:'matte',    name:'Matte gold',    hex:'#8C6A38' },
    { id:'oxidised', name:'Oxidised',      hex:'#5E4322' },
    { id:'silver',   name:'Silver',        hex:'#B6B2A6' },
  ];

  /* ---- Tiny inline icons ---- */
  const icon = (name) => {
    const p = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
    const set = {
      hand:    `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="M6 11V5a1.5 1.5 0 0 1 3 0v5M9 10V4a1.5 1.5 0 0 1 3 0v6M12 10V5.5a1.5 1.5 0 0 1 3 0V12M15 8.5a1.5 1.5 0 0 1 3 0V14c0 3.5-2 6-5.5 6S6 17.5 6 14v-3"/></svg>`,
      tag:     `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="M3 11V4h7l9 9-7 7-9-9Z"/><circle ${p} cx="7" cy="8" r="1.2"/></svg>`,
      ship:    `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="M2 14h18l-2 5H4l-2-5ZM4 14V6h8l4 4v4M12 6v4h4"/></svg>`,
      gear:    `<svg viewBox="0 0 22 22" width="18" height="18"><circle ${p} cx="11" cy="11" r="3"/><path ${p} d="M11 2v3M11 17v3M2 11h3M17 11h3M4.5 4.5l2 2M15.5 15.5l2 2M4.5 17.5l2-2M15.5 6.5l2-2"/></svg>`,
      box:     `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="M11 2 3 6v9l8 4 8-4V6l-8-4ZM3 6l8 4 8-4M11 10v9"/></svg>`,
      ruler:   `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="m3 14 11-11 5 5L8 19l-5-5Z M6 11l2 2 M9 8l2 2 M12 5l2 2"/></svg>`,
      shield:  `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="M11 2.5 4 5v6c0 4 3 6.4 7 8.5 4-2.1 7-4.5 7-8.5V5l-7-2.5Z"/></svg>`,
      clock:   `<svg viewBox="0 0 22 22" width="18" height="18"><circle ${p} cx="11" cy="11" r="8"/><path ${p} d="M11 6v5l3.5 2"/></svg>`,
      stamp:   `<svg viewBox="0 0 22 22" width="18" height="18"><path ${p} d="M5 18h12M7 16h8l-1-5h-2c-1-1-1-3 0-4 1-1 1-3 0-4H10c-1 1-1 3 0 4 1 1 1 3 0 4H8L7 16Z"/></svg>`,
    };
    return set[name] || '';
  };

  /* ---- not-found ---- */
  if(!product){
    root.innerHTML = `
      <div class="nf">
        <h2>Piece not found</h2>
        <p>The product you're looking for may have been retired or recoded.</p>
        <a href="index.html#catalogue" class="btn btn-ghost" style="width:auto;display:inline-flex;">Browse the catalogue</a>
      </div>`;
    return;
  }

  /* ---- photo gallery (images[] if present, else single image) ---- */
  const GALLERY = (Array.isArray(product.images) && product.images.length ? product.images : [product.image]).filter(Boolean);
  let lbIndex = 0;

  const fullSrc = (src) => window.xvImg ? xvImg(src, 2000) : src;
  const thumbSrc = (src) => window.xvImg ? xvImg(src, 200) : src;
  const mainSrc = (src) => window.xvImg ? xvImg(src, 1200) : src;

  function setMainImage(i){
    if(i < 0 || i >= GALLERY.length) return;
    lbIndex = i;
    const src = GALLERY[i];
    const main = root.querySelector('.main-shot img');
    if(main){
      main.src = mainSrc(src);
      main.dataset.full = fullSrc(src);
      main.dataset.i = String(i);
    }
    root.querySelectorAll('.pd-th').forEach(t => t.classList.toggle('on', +t.dataset.i === i));
  }

  function ensureLightbox(){
    let lb = document.getElementById('pdLightbox');
    if(lb) return lb;
    lb = document.createElement('div');
    lb.id = 'pdLightbox';
    lb.className = 'pd-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Product image');
    lb.innerHTML = `
      <button type="button" class="pd-lb-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>
      </button>
      <button type="button" class="pd-lb-prev" aria-label="Previous image">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4 6 9l5 5"/></svg>
      </button>
      <div class="pd-lb-inner">
        <img class="pd-lb-img" alt="">
      </div>
      <button type="button" class="pd-lb-next" aria-label="Next image">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4l5 5-5 5"/></svg>
      </button>
      <div class="pd-lb-count"></div>`;
    document.body.appendChild(lb);

    const img = lb.querySelector('.pd-lb-img');
    const count = lb.querySelector('.pd-lb-count');
    const prev = lb.querySelector('.pd-lb-prev');
    const next = lb.querySelector('.pd-lb-next');

    const render = () => {
      const src = GALLERY[lbIndex];
      img.src = fullSrc(src);
      img.alt = (product.name || '') + ' — photo ' + (lbIndex + 1);
      count.textContent = GALLERY.length > 1 ? (lbIndex + 1) + ' / ' + GALLERY.length : '';
      prev.hidden = GALLERY.length < 2;
      next.hidden = GALLERY.length < 2;
    };
    lb._render = render;

    const close = () => {
      lb.classList.remove('open');
      document.body.style.overflow = '';
    };
    const openAt = (i) => {
      lbIndex = Math.max(0, Math.min(GALLERY.length - 1, i));
      setMainImage(lbIndex);
      render();
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    lb._openAt = openAt;
    lb._close = close;

    lb.querySelector('.pd-lb-close').addEventListener('click', close);
    prev.addEventListener('click', (e) => { e.stopPropagation(); openAt((lbIndex - 1 + GALLERY.length) % GALLERY.length); });
    next.addEventListener('click', (e) => { e.stopPropagation(); openAt((lbIndex + 1) % GALLERY.length); });
    lb.addEventListener('click', (e) => {
      if(e.target === lb || e.target.classList.contains('pd-lb-inner')) close();
    });
    document.addEventListener('keydown', (e) => {
      if(!lb.classList.contains('open')) return;
      if(e.key === 'Escape') close();
      if(e.key === 'ArrowLeft') openAt((lbIndex - 1 + GALLERY.length) % GALLERY.length);
      if(e.key === 'ArrowRight') openAt((lbIndex + 1) % GALLERY.length);
    });

    // Swipe on mobile
    let touchX = null;
    lb.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if(touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if(Math.abs(dx) < 50 || GALLERY.length < 2) return;
      if(dx > 0) openAt((lbIndex - 1 + GALLERY.length) % GALLERY.length);
      else openAt((lbIndex + 1) % GALLERY.length);
    }, { passive: true });

    return lb;
  }

  function openLightbox(i){
    const lb = ensureLightbox();
    lb._openAt(typeof i === 'number' ? i : lbIndex);
  }

  root.addEventListener('click', (e) => {
    const th = e.target.closest('.pd-th');
    if(th){
      setMainImage(+th.dataset.i);
      return;
    }
    const main = e.target.closest('.main-shot');
    if(main){
      const img = main.querySelector('img');
      const i = img && img.dataset.i != null ? +img.dataset.i : lbIndex;
      openLightbox(i);
    }
  });
  root.addEventListener('keydown', (e) => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const main = e.target.closest('.main-shot');
    if(!main) return;
    e.preventDefault();
    openLightbox(lbIndex);
  });

  /* ---- meta + SEO (canonical, OG, Product structured data) ---- */
  const SITE_URL  = 'https://xanvor.com';
  const pageURL   = `${SITE_URL}/product.html?id=${encodeURIComponent(product.id)}`;
  const absImg    = (s) => `${SITE_URL}/${String(s||'').replace(/^\/+/,'')}`;
  const imageURL  = absImg(product.image);
  const metaDesc  = `${product.name} (${product.code}) — ${product.desc}`;
  document.title = `${product.name} — XANVOR`;
  document.querySelector('meta[name="description"]').setAttribute('content', metaDesc);
  document.querySelector('meta[property="og:title"]').setAttribute('content', `${product.name} — XANVOR`);
  document.querySelector('meta[property="og:description"]').setAttribute('content', product.desc);
  document.querySelector('meta[property="og:image"]').setAttribute('content', imageURL);
  (function injectSEO(){
    const head = document.head;
    const canon = document.createElement('link');
    canon.rel = 'canonical'; canon.href = pageURL; head.appendChild(canon);
    const ogu = document.createElement('meta');
    ogu.setAttribute('property','og:url'); ogu.content = pageURL; head.appendChild(ogu);
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.id,
      image: GALLERY.map(absImg),
      description: `${product.desc} ${product.materials ? product.materials.replace(/·/g,', ') + '.' : ''} Handcrafted in Moradabad, India.`.trim(),
      brand: { '@type': 'Brand', name: 'XANVOR' },
      material: (product.materials||'').split('·').map(s=>s.trim()).filter(Boolean).join(', ') || undefined,
    };
    /* offers only on retail-priced pieces; price is the GST-inclusive amount the buyer pays */
    const isPriced = typeof (product.retail || product.offer) === 'number' && product.mrp;
    if(isPriced){
      const rate  = (parseFloat(product.gst) / 100) || (window.XANVOR_SHOPCFG && window.XANVOR_SHOPCFG.GST) || 0.18;
      const base  = product.retail || product.offer;
      ld.offers = {
        '@type': 'Offer',
        url: pageURL,
        price: String(Math.round(base * (1 + rate))),
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: 'Zenko Inc.' },
      };
    }
    /* Google Product-snippet needs offers/review/aggregateRating. Enquiry-only
       (unpriced) pieces have none, so emit Product markup ONLY when priced —
       otherwise the page is fine but claims no product rich-result. */
    if(isPriced){
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(ld);
      head.appendChild(s);
    }
  })();

  /* ---- related ---- */
  function relatedFor(p){
    const sameSeries = all.filter(x => x.id !== p.id && x.series === p.series);
    const sameCollection = all.filter(x => x.id !== p.id && x.collection === p.collection && x.series !== p.series);
    return [...sameSeries, ...sameCollection].slice(0, 4);
  }
  const related = relatedFor(product);
  const seriesShort = (product.series || '').split('·')[0].trim();

  /* ---- pricing (Hot-Serve collection carries an offer price) ---- */
  const hasPrice = typeof product.offer === 'number';
  /* retail buy-box shows for anything customer-priced: retail (B2C) OR offer
     (legacy B2B-priced pieces) — offer-only was the old gate, which wrongly
     sent retail-only products (kn-101, ut-*) to the enquiry-only view */
  const hasRetail = typeof (product.retail || product.offer) === 'number' && !!product.mrp;
  const discPct  = hasPrice ? Math.round((1 - product.offer / product.mrp) * 100) : 0;
  const priceBlock = hasPrice ? `
        <div class="price-block">
          <div class="pb-label">Offer price · trade, ex-works</div>
          <div class="pb-row">
            <span class="pb-offer">${fmt(product.offer)}</span>
            <span class="pb-mrp">${fmt(product.mrp)}</span>
            <span class="pb-off">${discPct}% off</span>
          </div>
          <div class="pb-note">Per piece · ex-GST (${esc(product.gst||'18%')}) · ex-works Moradabad</div>
        </div>` : '';

  /* ---- highlights → feature list (falls back to generic spec list) ---- */
  const fIcons = ['shield','clock','box','stamp','gear'];
  const featsHTML = (product.highlights && product.highlights.length)
    ? product.highlights.map((h,i)=>`<li><span class="ic">${icon(fIcons[i % fIcons.length])}</span><div><b>${esc(h)}</b></div></li>`).join('')
    : `
          <li><span class="ic">${icon('stamp')}</span><div><b>Finish &amp; colourway.</b><span class="d">Antique, polished, matte, oxidised or silver — to your reference.</span></div></li>
          <li><span class="ic">${icon('ruler')}</span><div><b>Dimensions &amp; weight.</b><span class="d">Up- or down-scaled to your spec; we share a CAD before tooling.</span></div></li>
          <li><span class="ic">${icon('box')}</span><div><b>Packaging.</b><span class="d">Plain export carton, retail-ready gift box, or your branded packaging.</span></div></li>
          <li><span class="ic">${icon('shield')}</span><div><b>QC &amp; certification.</b><span class="d">Pre-shipment inspection, REACH/RoHS compliance on request.</span></div></li>`;
  const featH = (product.highlights && product.highlights.length) ? 'Highlights' : 'What you can specify';

  /* ---- spec rows ---- */
  const specRows = hasPrice ? `
        <div class="row"><b>Sizes</b><span>${esc(product.sizes||'—')}</span></div>
        <div class="row"><b>Construction</b><span>${esc(product.construction||'—')}</span></div>
        <div class="row"><b>MOQ</b><span>${esc(product.moq||'—')}</span></div>
        <div class="row"><b>HSN / GST</b><span>${esc(product.hsn||'—')} · ${esc(product.gst||'')}</span></div>` : `
        <div class="row"><b>Finish</b><span>Hand-applied at the workshop</span></div>
        <div class="row"><b>HSN code</b><span>On request</span></div>
        <div class="row"><b>Customisation</b><span>Size · finish · colourway</span></div>
        <div class="row"><b>Compliance</b><span>REACH / RoHS on request</span></div>`;

  /* ---- retail pricing & dual-mode buybox (Hot-Serve) ---- */
  const THRESHOLD = (window.XANVOR_SHOPCFG && window.XANVOR_SHOPCFG.THRESHOLD) || 50;
  /* per-product GST (e.g. "18%" / "12%"), falling back to the shop default */
  const GSTrate   = (parseFloat(product.gst) / 100) || (window.XANVOR_SHOPCFG && window.XANVOR_SHOPCFG.GST) || 0.18;
  const retail    = product.retail || product.offer;
  /* B2C sticker price is GST-inclusive — required for Google Merchant Center (India)
     and consistent with Indian retail norms. Checkout charges exactly this amount. */
  const incl      = Math.round(retail * (1 + GSTrate));
  const rdisc     = product.mrp ? Math.round((1 - incl / product.mrp) * 100) : 0;
  const gstPct    = Math.round(GSTrate * 100);
  const retailBadges =
    `<span class="b fill">${icon('hand')} Hand-cast in Moradabad</span>` +
    `<span class="b">${icon('ship')} Free shipping in India</span>` +
    `<span class="b">${icon('shield')} GST invoice · 7-day returns</span>`;
  const retailBuybox = `
      <aside class="buybox" id="buybox">
        <div class="bb-toggle" id="bbToggle">
          <button type="button" data-mode="retail" class="on">Buy retail</button>
          <button type="button" data-mode="wholesale">Wholesale ${THRESHOLD}+</button>
        </div>

        <div class="price-block retail-only">
          <div class="pb-label">Price · per piece</div>
          <div class="pb-row">
            <span class="pb-offer">${fmt(incl)}</span>
            <span class="pb-mrp">${fmt(product.mrp)}</span>
            <span class="pb-off">${rdisc}% off</span>
          </div>
          <div class="pb-note">Inclusive of ${gstPct}% GST · Free shipping across India</div>
        </div>
        <div class="price-block wholesale-only">
          <div class="pb-label">Wholesale · ex-works</div>
          <div class="pb-row">
            <span class="pb-mrp" style="text-decoration:none">from</span>
            <span class="pb-offer" id="wUnit">${typeof product.offer === 'number' ? fmt(product.offer) : 'on enquiry'}</span>
            <span class="pb-off">/ pc</span>
          </div>
          <div class="pb-note">Per piece · ex-GST · MOQ ${esc(product.moq||'50 pcs')} · drops with volume</div>
        </div>

        <div class="qty-input">
          <div class="lbl">Quantity</div>
          <div class="field">
            <button id="qtyMinus" aria-label="Decrease">−</button>
            <input id="qtyInput" type="number" min="1" value="1" inputmode="numeric">
            <button id="qtyPlus" aria-label="Increase">+</button>
            <div class="suffix">pcs</div>
          </div>
        </div>

        <div class="retail-only">
          <div class="quote-card">
            <div class="row"><span class="k">Subtotal · <span id="rQ">1 pc</span></span><span class="v" id="rSub">${fmt(incl)}</span></div>
            <div class="row"><span class="k">Incl. GST ${gstPct}%</span><span class="v" id="rGst">${fmt(incl - Math.round(incl/(1+GSTrate)))}</span></div>
            <div class="row price"><span class="k">Pay at checkout</span><span class="v" id="rTot">${fmt(incl)}</span></div>
          </div>
          <button class="btn btn-primary" id="ctaCart">${icon('tag')} Add to Cart</button>
          <button class="btn btn-ink" id="ctaBuy">${icon('box')} Buy Now</button>
          <div class="bb-switch">Ordering ${THRESHOLD} or more? <a href="#" id="goWholesale">See wholesale pricing →</a></div>
          <div class="secure">Free shipping across India · GST invoice · Easy 7-day returns</div>
        </div>

        <div class="wholesale-only">
          <div class="quote-card">
            <div class="row tier"><span class="k">Volume tier</span><span class="v" id="qTier">—</span></div>
            <div class="row"><span class="k">Indicative discount</span><span class="v"><em id="qDisc">—</em></span></div>
            <div class="row"><span class="k">Lead time</span><span class="v" id="qLead">—</span></div>
            <div class="row price"><span class="k">Est. order value</span><span class="v" id="qTotal">—</span></div>
          </div>
          <button class="btn btn-primary" id="ctaAdd">${icon('tag')} Add to Enquiry</button>
          <button class="btn btn-ghost" id="ctaQuote" type="button">${icon('clock')} Request bulk quote</button>
          <div class="secure">Confidential trade pricing · Reply within 1 working day</div>
        </div>
      </aside>`;

  /* ---- render ---- */
  root.innerHTML = `
    <div class="crumbs">
      <a href="index.html">Home</a>
      <span class="sep">/</span>
      <a href="index.html#catalogue">${esc(product.collection)}</a>
      <span class="sep">/</span>
      <span class="here">${esc(product.name)}</span>
    </div>

    <div class="pdp">

      <!-- GALLERY -->
      <div class="gallery">
        <div class="main-shot" role="button" tabindex="0" aria-label="View full size image" title="Click to enlarge">
          ${product.tag ? `<span class="badge-pin">${esc(product.tag)}</span>` : ''}
          <img src="${esc(mainSrc(GALLERY[0]))}" data-full="${esc(fullSrc(GALLERY[0]))}" data-i="0" alt="${esc(product.name)}">
          <span class="zoom-hint" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14M7 5v4M5 7h4"/></svg>
            Enlarge
          </span>
        </div>
        ${GALLERY.length > 1 ? `
        <div class="pd-thumbs">
          ${GALLERY.map((g,i)=>`<button type="button" class="pd-th${i===0?' on':''}" data-i="${i}" aria-label="Photo ${i+1}"><img src="${esc(thumbSrc(g))}" alt=""></button>`).join('')}
        </div>` : ''}
        <div class="shot-meta">Click image to enlarge · Photographed in Moradabad</div>
        <div class="finish-row">
          <div class="lbl">Available finishes</div>
          <div class="finishes" id="finishes">
            ${FINISHES.map((f,i)=>`
              <button class="finish${i===0?' on':''}" data-id="${f.id}">
                <span class="sw" style="background:${f.hex}"></span>${esc(f.name)}
              </button>`).join('')}
          </div>
        </div>
      </div>

      <!-- DETAILS -->
      <div class="p-detail">
        <div class="p-eyebrow">${esc(product.collection)} · ${esc(seriesShort)}</div>
        <h1>${esc(product.name)}</h1>
        <div class="p-code">${esc(product.code)}</div>
        <div class="p-badges">
          <span class="b fill">${icon('hand')} Hand-cast in Moradabad</span>
          <span class="b">${icon('gear')} OEM &amp; Private Label</span>
          <span class="b">${icon('ship')} FOB · EXW · DDP</span>
        </div>
        <div class="p-rule"></div>
        <p class="p-desc">${esc(product.desc)}</p>

        <div class="feat-h">${featH}</div>
        <ul class="feats">
          ${featsHTML}
        </ul>
      </div>

      <!-- B2B BULK QUOTE BOX -->
      <aside class="buybox" id="buybox">
        <div class="quote-h">Trade Desk · Bulk Quote</div>
        <div class="quote-title">${hasPrice ? 'Offer price &amp; bulk tiers' : 'Indicative pricing &amp; lead time'}</div>
        <p class="quote-p">${hasPrice ? 'The offer price below is per piece, ex-works. Enter a target quantity for the indicative bulk-tier discount, unit price and lead time.' : 'Final pricing is confidential and shared on enquiry. Enter your target quantity to see the indicative tier, discount band and lead time.'}</p>
        ${priceBlock}

        <div class="tier-chips" id="tierChips">
          <button data-q="5">Sample</button>
          <button data-q="50">50+</button>
          <button data-q="200">200+</button>
          <button data-q="500">500+</button>
          <button data-q="1000">1000+</button>
        </div>

        <div class="qty-input">
          <div class="lbl">Quantity</div>
          <div class="field">
            <button id="qtyMinus" aria-label="Decrease">−</button>
            <input id="qtyInput" type="number" min="1" value="200" inputmode="numeric">
            <button id="qtyPlus" aria-label="Increase">+</button>
            <div class="suffix">pcs</div>
          </div>
        </div>

        <div class="quote-card" id="quoteCard">
          <div class="row tier"><span class="k">Volume tier</span><span class="v" id="qTier">—</span></div>
          <div class="row"><span class="k">Indicative discount</span><span class="v"><em id="qDisc">—</em></span></div>
          <div class="row"><span class="k">Lead time</span><span class="v" id="qLead">—</span></div>
          <div class="row"><span class="k">Shipping terms</span><span class="v" id="qShip">—</span></div>
          <div class="row price"><span class="k">${hasPrice ? 'Est. unit price' : 'Unit price'}</span><span class="v" id="qUnit">${hasPrice ? fmt(product.offer) : 'disclosed on enquiry'}</span></div>
          ${hasPrice ? `<div class="row price"><span class="k">Est. order value</span><span class="v" id="qTotal">—</span></div>` : ''}
        </div>

        <button class="btn btn-primary" id="ctaAdd">
          ${icon('tag')} Add to Enquiry
        </button>
        <button class="btn btn-ink" id="ctaSample">
          ${icon('box')} Add as Sample · 5 pcs
        </button>
        <a class="btn btn-ghost" href="assets/catalogue/" id="ctaSpec" target="_blank" rel="noopener" style="text-decoration:none;">
          ${icon('clock')} Download Spec Sheet
        </a>
        <div class="secure">Confidential trade pricing · Reply within 1 working day · MOQ on enquiry</div>
      </aside>
    </div>

    <!-- A+ MODULES -->
    <div class="aplus">

      <div class="band-strip">
        <h2>Made in our <em>Moradabad</em> atelier</h2>
        <p>From sand-cast pour to hand-engraved finish, every piece is produced under one roof — and every order is run to your reference sample, not a stock SKU.</p>
      </div>

      <div class="grid-detail">
        <div class="dcard">
          <div class="ic">${icon('hand')}</div>
          <h3>Hand-finished</h3>
          <p>Each piece is cast, fettled and finished by craftspeople trained in the centuries-old Moradabad tradition.</p>
        </div>
        <div class="dcard">
          <div class="ic">${icon('gear')}</div>
          <h3>OEM &amp; private label</h3>
          <p>Your reference, your packaging, your barcode. We act as the silent maker behind premium retail and hospitality brands.</p>
        </div>
        <div class="dcard">
          <div class="ic">${icon('ship')}</div>
          <h3>Global logistics</h3>
          <p>Sea freight ex Mundra and Nhava Sheva, air cargo for urgent orders, DDP to most major markets.</p>
        </div>
      </div>

      <h2 class="sec-h">Bulk <em>pricing tiers</em></h2>
      <p class="sec-sub">Indicative only · Final on enquiry</p>
      <div class="tier-table">
        <table>
          <thead>
            <tr><th>Quantity</th><th>Indicative discount</th><th>Lead time</th><th>Shipping</th></tr>
          </thead>
          <tbody id="tierTableBody">
            ${TIERS.map(t=>`
              <tr data-tier="${t.id}">
                <td class="q">${esc(t.label.split('·')[1] ? t.label.split('·')[1].trim() : t.label)}</td>
                <td class="d">${esc(discLabelFor(t, product))}</td>
                <td>${esc(t.lead)}</td>
                <td>${esc(t.ship)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <h2 class="sec-h">Specifications</h2>
      <p class="sec-sub">${esc(seriesShort)}</p>
      <div class="specs">
        <div class="row"><b>Code</b><span>${esc(product.code)}</span></div>
        <div class="row"><b>Collection</b><span>${esc(product.collection)}</span></div>
        <div class="row"><b>Materials</b><span>${esc(product.materials)}</span></div>
        <div class="row"><b>Origin</b><span>Moradabad, India</span></div>
        ${specRows}
      </div>

      ${related.length ? `
      <div class="related">
        <div class="related-head">
          <h3>From the <em>same series</em></h3>
          <a href="index.html#catalogue">View all pieces →</a>
        </div>
        <div class="related-grid">
          ${related.map(r=>`
            <a class="rel-card" href="product.html?id=${esc(r.id)}">
              <div class="rel-img"><img src="${esc(window.xvImg ? xvImg(r.image, 480) : r.image)}" alt="${esc(r.name)}" loading="lazy"></div>
              <div class="rel-body">
                <h4>${esc(r.name)}</h4>
                <div class="rc">${esc(r.code)}</div>
              </div>
            </a>`).join('')}
        </div>
      </div>` : ''}
    </div>
  `;

  /* ---- buybox: swap to retail/wholesale dual-mode for priced items ---- */
  if(hasRetail){
    const bb = document.getElementById('buybox');
    if(bb) bb.outerHTML = retailBuybox;
    const fr = document.querySelector('.finish-row'); if(fr) fr.style.display = 'none';
    const pbg = document.querySelector('.p-badges'); if(pbg) pbg.innerHTML = retailBadges;
  }

  const qtyInput  = document.getElementById('qtyInput');
  const qtyMinus  = document.getElementById('qtyMinus');
  const qtyPlus   = document.getElementById('qtyPlus');
  const tableBody = document.getElementById('tierTableBody');
  const clampQ = v => Math.max(1, Math.min(99999, parseInt(v||'0',10)||1));

  if(hasRetail){
    const buybox = document.getElementById('buybox');
    const toggle = document.getElementById('bbToggle');
    const rQ=document.getElementById('rQ'), rSub=document.getElementById('rSub'), rGst=document.getElementById('rGst'), rTot=document.getElementById('rTot');
    const wUnit=document.getElementById('wUnit'), qTier=document.getElementById('qTier'), qDisc=document.getElementById('qDisc'), qLead=document.getElementById('qLead'), qTotal=document.getElementById('qTotal');
    function update(){
      const q=clampQ(qtyInput.value); qtyInput.value=q;
      const wholesale = q>=THRESHOLD;
      buybox.classList.toggle('is-wholesale', wholesale);
      [...toggle.children].forEach(b=>b.classList.toggle('on',(b.dataset.mode==='wholesale')===wholesale));
      if(!wholesale){
        const sub=incl*q;
        if(rQ) rQ.textContent = q+' pc'+(q>1?'s':'');
        rSub.textContent=fmt(sub); rGst.textContent=fmt(sub - Math.round(sub/(1+GSTrate))); rTot.textContent=fmt(sub);
      } else {
        /* wholesale unit derives from the B2B offer price; retail-only pieces
           have no offer — their trade pricing stays "on enquiry" (no NaN) */
        const t=tierFor(q);
        const unit = typeof product.offer === 'number' ? Math.round(product.offer*(1-t.pct)) : null;
        if(wUnit) wUnit.textContent = unit ? fmt(unit) : 'on enquiry';
        qTier.textContent=t.label.replace(/^[^·]+·\s*/,''); qDisc.textContent=discLabelFor(t, product); qLead.textContent=t.lead;
        qTotal.textContent = unit ? fmt(unit*q) : 'on enquiry';
        if(tableBody)[...tableBody.children].forEach(tr=>tr.classList.toggle('active',tr.dataset.tier===t.id));
      }
    }
    qtyInput.addEventListener('input',update);
    qtyMinus.addEventListener('click',()=>{const q=clampQ(qtyInput.value);qtyInput.value=Math.max(1,q-(q>50?50:1));update();});
    qtyPlus .addEventListener('click',()=>{const q=clampQ(qtyInput.value);qtyInput.value=q+(q>=50?50:1);update();});
    [...toggle.children].forEach(b=>b.addEventListener('click',()=>{
      const q=clampQ(qtyInput.value);
      if(b.dataset.mode==='wholesale'){ if(q<THRESHOLD) qtyInput.value=THRESHOLD; }
      else { if(q>=THRESHOLD) qtyInput.value=1; }
      update();
    }));
    const goW=document.getElementById('goWholesale');
    if(goW) goW.addEventListener('click',e=>{e.preventDefault(); qtyInput.value=THRESHOLD; update();});
    const addCart=(go)=>{
      const q=clampQ(qtyInput.value);
      if(window.XanvorShop) window.XanvorShop.add({id:product.id,code:product.code,name:product.name,image:product.image,price:incl,mrp:product.mrp,qty:q});
      if(go){ location.href='checkout.html'; } else if(window.XanvorShop){ setTimeout(()=>window.XanvorShop.open(),260); }
    };
    const cC=document.getElementById('ctaCart'); if(cC) cC.addEventListener('click',()=>addCart(false));
    const cB=document.getElementById('ctaBuy');  if(cB) cB.addEventListener('click',()=>addCart(true));
    const addEnq=()=>{ const q=clampQ(qtyInput.value); if(window.XanvorBasket){ window.XanvorBasket.add({code:product.code,name:product.name,image:product.image,qty:q,finish:''}); setTimeout(()=>window.XanvorBasket.open(),260);} };
    const cA=document.getElementById('ctaAdd');   if(cA) cA.addEventListener('click',addEnq);
    const cQ=document.getElementById('ctaQuote'); if(cQ) cQ.addEventListener('click',addEnq);
    update();
  } else {
    const tierChips=document.getElementById('tierChips');
    const qTier=document.getElementById('qTier'),qDisc=document.getElementById('qDisc'),qLead=document.getElementById('qLead'),qShip=document.getElementById('qShip'),qUnit=document.getElementById('qUnit'),qTotal=document.getElementById('qTotal');
    function syncQuote(){
      const q=clampQ(qtyInput.value); qtyInput.value=q;
      const t=tierFor(q);
      qTier.textContent=t.label.replace(/^[^·]+·\s*/,'');
      qDisc.textContent=discLabelFor(t, product); qLead.textContent=t.lead; qShip.textContent=t.ship;
      [...tierChips.children].forEach(b=>b.classList.toggle('on',parseInt(b.dataset.q,10)===t.q));
      if(tableBody)[...tableBody.children].forEach(tr=>tr.classList.toggle('active',tr.dataset.tier===t.id));
    }
    qtyInput.addEventListener('input',syncQuote);
    qtyMinus.addEventListener('click',()=>{qtyInput.value=Math.max(1,(parseInt(qtyInput.value,10)||1)-(parseInt(qtyInput.value,10)>50?50:10));syncQuote();});
    qtyPlus .addEventListener('click',()=>{qtyInput.value=(parseInt(qtyInput.value,10)||0)+(parseInt(qtyInput.value,10)>=50?50:10);syncQuote();});
    [...tierChips.children].forEach(b=>b.addEventListener('click',()=>{qtyInput.value=b.dataset.q;syncQuote();}));
    syncQuote();
    const currentFinish=()=>(document.querySelector('#finishes .finish.on')||{}).dataset?.id||'antique';
    const addToBasket=(qty)=>{
      if(!window.XanvorBasket){ const qp=new URLSearchParams({product:product.code,name:product.name,qty,finish:currentFinish()}); location.href=`index.html?${qp.toString()}#enquiry-form`; return; }
      window.XanvorBasket.add({code:product.code,name:product.name,image:product.image,qty:qty,finish:currentFinish()});
      setTimeout(()=>window.XanvorBasket.open(),280);
    };
    document.getElementById('ctaAdd').addEventListener('click',()=>addToBasket(qtyInput.value));
    document.getElementById('ctaSample').addEventListener('click',()=>addToBasket(5));
  }

  /* ---- finish selector (visual only) ---- */
  document.querySelectorAll('#finishes .finish').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#finishes .finish').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
    });
  });

  /* ---- nav scroll ---- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  onScroll(); window.addEventListener('scroll', onScroll, { passive:true });
})();

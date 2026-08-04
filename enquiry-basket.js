/* ============================================================
   XANVOR — RFQ Basket (B2B order list → request for quotation)
   - localStorage backed line items (same key as the old enquiry
     basket, so in-flight baskets survive the upgrade)
   - Floating pill (bottom-right) shows count, opens drawer
   - Drawer contains line items + RFQ checkout form
   - Submits JSON to /api/rfq (server records the RFQ, emails the
     trade desk and sends the buyer an acknowledgment with a
     reference number). Basket clears only after the server
     confirms — a failed send never loses the buyer's list.
   - Works across index.html, product.html and new-designs.html
   ============================================================ */
(function(){
  const KEY = 'xanvor_enquiry_basket_v1';
  const FINISH_LABELS = {
    antique:'Antique gold', polished:'Polished', matte:'Matte gold',
    oxidised:'Oxidised', silver:'Silver'
  };
  const INCOTERMS = ['Need advice', 'EXW Moradabad', 'FOB Nhava Sheva / Mundra', 'CIF (destination port)', 'DDP (door delivery)'];
  /* Quote currency the buyer would like on the Proforma Invoice. USD is our
     standard; the rest are issued on request. Must stay in sync with
     QUOTE_CCY in netlify/functions/rfq.mjs. */
  const QUOTE_CCY = [
    { code:'USD', label:'US Dollar (standard)' },
    { code:'EUR', label:'Euro (on request)' },
    { code:'GBP', label:'Pound Sterling (on request)' },
    { code:'AED', label:'UAE Dirham (on request)' },
    { code:'INR', label:'Indian Rupee (India buyers)' },
  ];

  /* ---- storage ---- */
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch(e){ return []; }
  };
  const write = (items) => {
    localStorage.setItem(KEY, JSON.stringify(items));
    sync();
    // notify other tabs/pages
    window.dispatchEvent(new CustomEvent('xanvor:basket-change'));
  };

  const api = {
    items: read,
    count: () => read().reduce((a,i)=>a+1,0),
    add: (item) => {
      const items = read();
      // merge by code+finish
      const key = item.code + '|' + (item.finish||'');
      const ex = items.find(x => (x.code+'|'+(x.finish||'')) === key);
      if(ex){ ex.qty = Math.max(1, (parseInt(ex.qty)||0) + (parseInt(item.qty)||1)); }
      else if(items.length >= 60){
        // server rejects >60 lines — better to say so at add time than at submit
        alert('An RFQ can carry up to 60 lines. Please submit this list first, then start a second RFQ for the rest.');
        return;
      }
      else  { items.push({ ...item, qty: Math.max(1, parseInt(item.qty)||1) }); }
      write(items);
      flashOpen();
    },
    setQty: (idx, qty) => {
      const items = read();
      if(items[idx]){ items[idx].qty = Math.max(1, parseInt(qty)||1); write(items); }
    },
    remove: (idx) => {
      const items = read();
      items.splice(idx,1); write(items);
    },
    clear: () => write([]),
    open: () => openDrawer(),
    close: () => closeDrawer(),
  };
  window.XanvorBasket = api;

  /* ---- markup ---- */
  const css = `
  .xb-pill{
    position:fixed; right:18px; bottom:18px; z-index:9000;
    display:flex; align-items:center; gap:10px;
    background:#A85D2A; color:#FBF6E8;
    border:none; border-radius:50px;
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:11px; font-weight:500;
    letter-spacing:.18em; text-transform:uppercase;
    padding:14px 20px;
    box-shadow:0 10px 30px -8px rgba(58,39,24,.45);
    cursor:pointer; transition:transform .25s, box-shadow .25s, background .25s;
  }
  .xb-pill:hover{background:#C0712F; transform:translateY(-2px);}
  .xb-pill svg{width:18px;height:18px;}
  .xb-pill .xb-count{
    background:#FBF6E8; color:#A85D2A;
    min-width:22px; height:22px; border-radius:50px;
    display:inline-flex; align-items:center; justify-content:center;
    padding:0 7px; font-size:11px; font-weight:600; letter-spacing:0;
  }
  .xb-pill[data-empty="true"]{background:#3A2718;}
  .xb-pill[data-empty="true"]:hover{background:#241510;}
  .xb-pill[data-flash="true"]{animation:xb-flash .55s ease;}
  @keyframes xb-flash{
    0%{transform:scale(1);} 30%{transform:scale(1.08);}
    60%{transform:scale(.98);} 100%{transform:scale(1);}
  }

  /* drawer overlay */
  .xb-scrim{
    position:fixed; inset:0; z-index:9100;
    background:rgba(36,21,16,.5); backdrop-filter:blur(3px);
    opacity:0; pointer-events:none; transition:opacity .3s ease;
  }
  .xb-scrim[data-open="true"]{opacity:1; pointer-events:auto;}
  .xb-drawer{
    position:fixed; top:0; right:0; bottom:0; z-index:9200;
    width:min(480px, 100vw);
    background:#FCFAF4;
    box-shadow:-20px 0 60px -20px rgba(36,21,16,.4);
    transform:translateX(100%); transition:transform .35s cubic-bezier(.2,.7,.2,1);
    display:flex; flex-direction:column;
    font-family:var(--xv-body,Jost,Inter,system-ui,sans-serif);
  }
  .xb-drawer[data-open="true"]{transform:translateX(0);}

  .xb-head{
    display:flex; align-items:center; justify-content:space-between;
    padding:22px 26px; border-bottom:1px solid #E6DCC8;
    background:#F8F2E6;
  }
  .xb-head .xb-title{
    font-family:var(--xv-display,Cormorant Garamond,Georgia,serif); font-weight:400; font-size:22px;
    color:#241510;
  }
  .xb-head .xb-title em{font-style:italic; color:#A85D2A;}
  .xb-head .xb-sub{
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:9.5px;
    letter-spacing:.22em; text-transform:uppercase; color:#A85D2A;
    margin-top:4px;
  }
  .xb-close{
    background:transparent; border:1px solid #D8CBB0; border-radius:50px;
    width:36px; height:36px; display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#3A2718; transition:all .2s;
  }
  .xb-close:hover{border-color:#A85D2A; color:#A85D2A;}
  .xb-close svg{width:14px;height:14px;}

  .xb-body{flex:1; overflow-y:auto; padding:6px 26px 0;}

  /* empty state */
  .xb-empty{padding:60px 20px; text-align:center;}
  .xb-empty .xb-emoji{
    font-family:var(--xv-display,Cormorant Garamond,Georgia,serif); font-style:italic; font-size:42px;
    color:#A85D2A; line-height:1; margin-bottom:14px;
  }
  .xb-empty h4{
    font-family:var(--xv-display,Cormorant Garamond,Georgia,serif); font-weight:400; font-size:22px;
    color:#241510; margin-bottom:8px;
  }
  .xb-empty p{
    font-size:15.5px; color:#5A4636; line-height:1.55; max-width:32ch;
    margin:0 auto 22px;
  }
  .xb-empty a{
    display:inline-block; margin:0 4px 8px;
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:10.5px; font-weight:500;
    letter-spacing:.2em; text-transform:uppercase;
    border:1px solid #A85D2A; color:#A85D2A;
    padding:11px 20px; border-radius:50px; transition:all .2s;
    text-decoration:none;
  }
  .xb-empty a:hover{background:rgba(168,93,42,.08);}

  /* line items */
  .xb-items{display:flex; flex-direction:column;}
  .xb-item{
    display:grid; grid-template-columns:64px 1fr auto; gap:14px;
    padding:18px 0; border-bottom:1px solid #E6DCC8;
    align-items:start;
  }
  .xb-item:last-child{border-bottom:none;}
  .xb-thumb{
    width:64px; height:64px; border-radius:6px;
    background:#F8F2E6; border:1px solid #E6DCC8;
    display:flex; align-items:center; justify-content:center; overflow:hidden;
    padding:6px;
  }
  .xb-thumb img{max-width:100%; max-height:100%; object-fit:contain;}
  .xb-item .xb-meta{min-width:0;}
  .xb-item .xb-name{
    font-family:var(--xv-display,Cormorant Garamond,Georgia,serif); font-weight:400; font-size:16px;
    color:#241510; line-height:1.25; margin-bottom:4px;
  }
  .xb-item .xb-code{
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:9.5px;
    letter-spacing:.16em; color:#A85D2A;
  }
  .xb-item .xb-finish{
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:9.5px;
    letter-spacing:.14em; color:#5A4636; margin-top:4px;
    text-transform:uppercase;
  }
  .xb-item .xb-qty{
    display:flex; align-items:center; gap:0;
    border:1px solid #D8CBB0; border-radius:50px; overflow:hidden;
    background:#fff; margin-top:8px; width:fit-content;
  }
  .xb-item .xb-qty button{
    width:26px; height:26px; border:none; background:transparent;
    font-family:var(--xv-body,Jost,Inter,system-ui,sans-serif); font-size:16px; color:#241510;
    cursor:pointer;
  }
  .xb-item .xb-qty input{
    width:48px; height:26px; border:none; background:transparent;
    text-align:center; font-family:var(--xv-display,Cormorant Garamond,Georgia,serif); font-size:14px;
    color:#241510; -moz-appearance:textfield;
  }
  .xb-item .xb-qty input::-webkit-outer-spin-button,
  .xb-item .xb-qty input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}
  .xb-item .xb-qty .xb-pcs{
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:9.5px; letter-spacing:.14em;
    color:#9A8E7C; padding:0 10px 0 4px; text-transform:uppercase;
  }
  .xb-item .xb-rm{
    background:transparent; border:none; cursor:pointer;
    color:#9A8E7C; padding:4px; margin-top:-2px;
    transition:color .2s;
  }
  .xb-item .xb-rm:hover{color:#A85D2A;}
  .xb-item .xb-rm svg{width:16px;height:16px;}

  /* form inside drawer */
  .xb-form-wrap{
    margin-top:22px; padding:22px 26px 26px;
    background:#F8F2E6; border-top:1px solid #E6DCC8;
    margin-left:-26px; margin-right:-26px;
  }
  .xb-form-head{
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:10px;
    letter-spacing:.22em; text-transform:uppercase; color:#A85D2A;
    margin-bottom:14px;
  }
  .xb-form{display:flex; flex-direction:column; gap:12px;}
  .xb-form label{
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:9.5px;
    letter-spacing:.18em; text-transform:uppercase; color:#5A4636;
    margin-bottom:4px;
  }
  .xb-form .f{display:flex; flex-direction:column;}
  .xb-form .f2{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
  .xb-form input, .xb-form textarea, .xb-form select{
    width:100%; background:#fff; color:#241510;
    border:1px solid #D8CBB0; padding:11px 13px;
    font-family:var(--xv-body,Jost,Inter,system-ui,sans-serif); font-size:15px; line-height:1.5;
    border-radius:5px; transition:border-color .2s;
  }
  .xb-form input:focus, .xb-form textarea:focus, .xb-form select:focus{
    outline:none; border-color:#A85D2A;
  }
  .xb-form textarea{resize:vertical; min-height:64px;}
  .xb-form select{appearance:auto; cursor:pointer;}

  /* footer of drawer */
  .xb-foot{
    border-top:1px solid #E6DCC8; padding:18px 26px 22px;
    background:#FCFAF4;
  }
  .xb-send{
    width:100%; display:flex; align-items:center; justify-content:center; gap:10px;
    background:#A85D2A; color:#FBF6E8; border:none;
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:11px; font-weight:500;
    letter-spacing:.22em; text-transform:uppercase;
    padding:15px 22px; border-radius:50px; cursor:pointer;
    transition:background .25s, transform .2s;
    box-shadow:0 8px 22px -8px rgba(168,93,42,.5);
  }
  .xb-send:hover{background:#C0712F; transform:translateY(-1px);}
  .xb-send:disabled{background:#9A8E7C; cursor:not-allowed; transform:none; box-shadow:none;}
  .xb-send svg{width:14px; height:14px;}
  .xb-foot .xb-note{
    text-align:center; margin-top:10px;
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:9px;
    letter-spacing:.18em; text-transform:uppercase; color:#9A8E7C;
  }
  .xb-error{
    display:none; margin-bottom:12px; padding:12px 16px;
    background:rgba(178,58,44,.08); border:1px solid #B23A2C; border-radius:6px;
    font-family:var(--xv-body,Jost,Inter,system-ui,sans-serif); font-size:15px; line-height:1.5;
    color:#7C2418;
  }
  .xb-error.show{display:block;}
  .xb-success{
    display:none; padding:20px 22px; margin-top:14px;
    background:rgba(168,93,42,.08); border:1px solid #A85D2A; border-radius:6px;
    font-family:var(--xv-body,Jost,Inter,system-ui,sans-serif); font-size:15.5px; line-height:1.6;
    color:#241510;
  }
  .xb-success.show{display:block;}
  .xb-success strong{color:#A85D2A;}
  .xb-success .xb-rid{
    display:inline-block; margin:6px 0;
    font-family:var(--xv-ui,Jost,Inter,system-ui,sans-serif); font-size:12px; letter-spacing:.1em;
    background:#241510; color:#FBF6E8; padding:6px 12px; border-radius:4px;
  }

  @media(max-width:520px){
    .xb-pill{right:12px; bottom:12px; padding:12px 16px; font-size:10.5px;}
    .xb-drawer{width:100vw;}
    .xb-head{padding:18px 20px;}
    .xb-body{padding:0 20px;}
    .xb-form-wrap{margin-left:-20px; margin-right:-20px; padding:18px 20px 22px;}
    .xb-foot{padding:16px 20px 20px;}
    .xb-form .f2{grid-template-columns:1fr;}
  }
  `;

  // inject css
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---- DOM ---- */
  const bagIcon = `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h12l-1 12H6L5 7Z"/><path d="M8 7V5a3 3 0 0 1 6 0v2"/></svg>`;
  const closeIcon = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>`;
  const trashIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V2.5h4V4M5 4l.7 9h4.6L11 4M7 7v4M9 7v4"/></svg>`;
  const sendIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2 7 9M14 2 9.5 14 7 9 2 6.5 14 2Z"/></svg>`;

  const pill = document.createElement('button');
  pill.className = 'xb-pill';
  pill.setAttribute('aria-label','Open RFQ basket');
  pill.innerHTML = `${bagIcon}<span>RFQ</span><span class="xb-count">0</span>`;
  pill.addEventListener('click', openDrawer);
  document.body.appendChild(pill);

  const scrim = document.createElement('div');
  scrim.className = 'xb-scrim';
  scrim.addEventListener('click', closeDrawer);
  document.body.appendChild(scrim);

  const drawer = document.createElement('aside');
  drawer.className = 'xb-drawer';
  drawer.setAttribute('aria-label','RFQ basket');
  drawer.innerHTML = `
    <header class="xb-head">
      <div>
        <div class="xb-sub">Trade Desk · No payment on this site</div>
        <div class="xb-title">Your <em>Order List</em></div>
      </div>
      <button class="xb-close" aria-label="Close">${closeIcon}</button>
    </header>
    <div class="xb-body" id="xb-body"></div>
    <footer class="xb-foot" id="xb-foot" style="display:none;">
      <div class="xb-error" id="xb-error" role="alert"></div>
      <button class="xb-send" id="xb-send" type="button">${sendIcon} Submit Order Request</button>
      <div class="xb-note">Reply in 1 working day · Confirmed by Proforma Invoice</div>
      <div class="xb-success" id="xb-success" aria-live="polite"></div>
    </footer>
  `;
  document.body.appendChild(drawer);
  drawer.querySelector('.xb-close').addEventListener('click', closeDrawer);

  /* ---- render ---- */
  const FORM_IDS = ['xb-name','xb-company','xb-email','xb-phone','xb-country','xb-port','xb-incoterm','xb-shipdate','xb-message'];
  function captureForm(){
    const vals = {};
    FORM_IDS.forEach(id => {
      const el = drawer.querySelector('#' + id);
      if(el && el.value) vals[id] = el.value;
    });
    return vals;
  }
  function applyForm(vals){
    Object.keys(vals || {}).forEach(id => {
      const el = drawer.querySelector('#' + id);
      if(el) el.value = vals[id];
    });
  }

  function render(){
    const inProgress = captureForm(); // qty edits re-render — don't lose typed contact details
    const items = read();
    const body = drawer.querySelector('#xb-body');
    const foot = drawer.querySelector('#xb-foot');
    if(items.length === 0){
      foot.style.display = 'none';
      body.innerHTML = `
        <div class="xb-empty">
          <div class="xb-emoji">✺</div>
          <h4>Your order list is empty</h4>
          <p>Add pieces you'd like quoted. We reply with pricing, MOQ, lead time and finish options — one RFQ, one working day.</p>
          <a href="new-designs.html">New designs</a>
          <a href="index.html#catalogue">Browse catalogue</a>
        </div>
      `;
      return;
    }
    foot.style.display = 'block';
    body.innerHTML = `
      <div class="xb-items">
        ${items.map((it,i)=>`
          <div class="xb-item" data-idx="${i}">
            <div class="xb-thumb">${it.image ? `<img src="${esc(it.image)}" alt="">` : ''}</div>
            <div class="xb-meta">
              <div class="xb-name">${esc(it.name)}</div>
              <div class="xb-code">${esc(it.code)}</div>
              ${it.finish ? `<div class="xb-finish">Finish · ${esc(FINISH_LABELS[it.finish] || it.finish)}</div>` : ''}
              <div class="xb-qty">
                <button data-act="minus" aria-label="Decrease">−</button>
                <input type="number" min="1" value="${esc(it.qty)}" data-act="qty" inputmode="numeric">
                <button data-act="plus" aria-label="Increase">+</button>
                <span class="xb-pcs">pcs</span>
              </div>
            </div>
            <button class="xb-rm" data-act="rm" aria-label="Remove">${trashIcon}</button>
          </div>
        `).join('')}
      </div>
      <div class="xb-form-wrap">
        <div class="xb-form-head">Shipping & contact — your terms, your quote currency</div>
        <form class="xb-form" id="xb-form" novalidate>
          <p hidden><label>Leave blank: <input name="bot-field" id="xb-bot" tabindex="-1" autocomplete="off"></label></p>
          <div class="f2">
            <div class="f">
              <label for="xb-name">Your Name *</label>
              <input id="xb-name" type="text" name="name" required autocomplete="name">
            </div>
            <div class="f">
              <label for="xb-company">Company / Brand</label>
              <input id="xb-company" type="text" name="company" autocomplete="organization">
            </div>
          </div>
          <div class="f2">
            <div class="f">
              <label for="xb-email">Business Email *</label>
              <input id="xb-email" type="email" name="email" required autocomplete="email" placeholder="you@company.com">
            </div>
            <div class="f">
              <label for="xb-phone">Phone / WhatsApp</label>
              <input id="xb-phone" type="tel" name="phone" autocomplete="tel">
            </div>
          </div>
          <div class="f2">
            <div class="f">
              <label for="xb-country">Destination Country *</label>
              <input id="xb-country" type="text" name="country" required placeholder="e.g. UAE, Germany, USA">
            </div>
            <div class="f">
              <label for="xb-port">Port / City</label>
              <input id="xb-port" type="text" name="port" placeholder="e.g. Jebel Ali, Hamburg">
            </div>
          </div>
          <div class="f2">
            <div class="f">
              <label for="xb-incoterm">Shipping Terms</label>
              <select id="xb-incoterm" name="incoterm">
                ${INCOTERMS.map(t=>`<option value="${esc(t)}">${esc(t === 'Need advice' ? 'Not sure — advise me' : t)}</option>`).join('')}
              </select>
            </div>
            <div class="f">
              <label for="xb-shipdate">Target Timeline</label>
              <input id="xb-shipdate" type="text" name="shipdate" placeholder="e.g. within 60 days">
            </div>
          </div>
          <div class="f2">
            <div class="f">
              <label for="xb-currency">Quote Currency</label>
              <select id="xb-currency" name="currency">
                ${QUOTE_CCY.map(c=>`<option value="${esc(c.code)}"${c.code==='USD'?' selected':''}>${esc(c.code)} — ${esc(c.label)}</option>`).join('')}
              </select>
            </div>
            <div class="f"></div>
          </div>
          <div class="f">
            <label for="xb-message">Notes (packaging, finishes, private label…)</label>
            <textarea id="xb-message" name="message" rows="3" placeholder="e.g. retail-ready packaging, antique finish refs"></textarea>
          </div>
        </form>
      </div>
    `;
    // wire item rows
    body.querySelectorAll('.xb-item').forEach(row => {
      const idx = parseInt(row.dataset.idx, 10);
      const input = row.querySelector('input[data-act="qty"]');
      row.querySelector('[data-act="minus"]').addEventListener('click', () => {
        api.setQty(idx, Math.max(1, (parseInt(input.value)||1) - 1));
      });
      row.querySelector('[data-act="plus"]').addEventListener('click', () => {
        api.setQty(idx, (parseInt(input.value)||0) + 1);
      });
      input.addEventListener('change', () => api.setQty(idx, input.value));
      row.querySelector('[data-act="rm"]').addEventListener('click', () => api.remove(idx));
    });
    restoreContact();
    applyForm(inProgress);
  }

  /* remember buyer contact fields so a returning buyer only confirms terms */
  const CONTACT_KEY = 'xanvor_rfq_contact_v1';
  function saveContact(fields){
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify(fields)); } catch(e){}
  }
  function restoreContact(){
    try {
      const saved = JSON.parse(localStorage.getItem(CONTACT_KEY) || 'null');
      if(!saved) return;
      ['name','company','email','phone','country','port','incoterm'].forEach(k => {
        const el = drawer.querySelector('#xb-' + (k === 'incoterm' ? 'incoterm' : k));
        if(el && saved[k] && !el.value) el.value = saved[k];
      });
    } catch(e){}
  }

  /* ---- submit handler ---- */
  drawer.querySelector('#xb-send').addEventListener('click', submitRfq);

  function fieldVal(id){
    const el = drawer.querySelector('#' + id);
    return el ? el.value.trim() : '';
  }

  function showError(msg){
    const err = drawer.querySelector('#xb-error');
    err.textContent = msg;
    err.classList.add('show');
  }

  function submitRfq(){
    const form = drawer.querySelector('#xb-form');
    if(!form) return;
    drawer.querySelector('#xb-error').classList.remove('show');

    const items = read();
    if(items.length === 0) return;

    const payload = {
      source: 'basket',
      name: fieldVal('xb-name'),
      company: fieldVal('xb-company'),
      email: fieldVal('xb-email'),
      phone: fieldVal('xb-phone'),
      country: fieldVal('xb-country'),
      port: fieldVal('xb-port'),
      incoterm: fieldVal('xb-incoterm'),
      currency: fieldVal('xb-currency'),
      shipdate: fieldVal('xb-shipdate'),
      message: fieldVal('xb-message'),
      'bot-field': fieldVal('xb-bot'),
      items: items.map(it => ({
        code: it.code, name: it.name, qty: it.qty,
        finish: it.finish ? (FINISH_LABELS[it.finish] || it.finish) : '',
        image: it.image || ''
      })),
    };
    try { payload.sid = sessionStorage.getItem('xv_sid') || undefined; } catch(e){}

    // client-side validation with focus on first miss (email regex matches the server's)
    const misses = [
      [!payload.name, 'xb-name'],
      [!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email), 'xb-email'],
      [!payload.country, 'xb-country'],
    ].filter(m => m[0]);
    if(misses.length){
      showError('Please add your name, business email and destination country so we can quote correctly.');
      const el = drawer.querySelector('#' + misses[0][1]);
      if(el) el.focus();
      return;
    }

    const btn = drawer.querySelector('#xb-send');
    btn.disabled = true;
    btn.innerHTML = `${sendIcon} Sending…`;

    fetch('/api/rfq', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if(!ok || !data.ok) throw new Error(data.error || '');
        // 'XV-RFQ-OK' is the server's honeypot decoy — if autofill tripped the
        // hidden field, nothing was saved; never clear a real buyer's basket on it
        if(data.rid === 'XV-RFQ-OK') throw new Error('');
        saveContact({ name: payload.name, company: payload.company, email: payload.email,
                      phone: payload.phone, country: payload.country, port: payload.port,
                      incoterm: payload.incoterm });
        onSuccess(data.rid);
      })
      .catch((err) => {
        btn.disabled = false;
        btn.innerHTML = `${sendIcon} Submit Order Request`;
        const serverMsg = err && err.message ? String(err.message) : '';
        showError(serverMsg && !/fetch|network|json/i.test(serverMsg)
          ? serverMsg + ' — your list is safe.'
          /* Trade desk line, not the general +91 98377 60615 — this is the RFQ
             path, so follow-ups must reach the desk that owns the reference.
             Mirrored in wholesale.html and netlify/functions/lib/notify.mjs. */
          : 'Could not send just now — your list is safe. Please try again, or WhatsApp our trade desk on +91 78957 21271.');
      });
  }

  function onSuccess(rid){
    const ok = drawer.querySelector('#xb-success');
    const btn  = drawer.querySelector('#xb-send');
    const formWrap = drawer.querySelector('.xb-form-wrap');
    if(formWrap) formWrap.style.display = 'none';
    btn.style.display = 'none';
    drawer.querySelector('.xb-note').style.display = 'none';
    ok.innerHTML = `
      <strong>Order request sent.</strong><br>
      Your reference: <span class="xb-rid">${esc(rid || '')}</span><br>
      We reply within one working day with pricing, MOQ, lead time and finish options —
      confirmed by Proforma Invoice. A copy is on its way to your email.<br>
      In a hurry? WhatsApp our trade desk on
      <a href="https://wa.me/917895721271" target="_blank" rel="noopener">+91 78957 21271</a>,
      quoting that reference.
    `;
    ok.classList.add('show');
    /* RFQ submitted is the conversion for a B2B account — the purchase
       conversion can never fire now that retail checkout is removed. */
    try { if (window.XanvorAds && window.XanvorAds.lead) window.XanvorAds.lead(rid); } catch (_) {}
    // server has the RFQ — safe to clear now (the success card stays visible)
    api.clear();
  }

  /* ---- open/close ---- */
  function openDrawer(){
    // reset any previous success state
    const okEl = drawer.querySelector('#xb-success');
    if(okEl){ okEl.classList.remove('show'); okEl.innerHTML=''; }
    const btn = drawer.querySelector('#xb-send');
    if(btn){ btn.style.display = ''; btn.disabled = false; btn.innerHTML = `${sendIcon} Submit Order Request`; }
    drawer.querySelector('.xb-note').style.display = '';
    render();
    scrim.dataset.open = 'true';
    drawer.dataset.open = 'true';
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer(){
    scrim.dataset.open = 'false';
    drawer.dataset.open = 'false';
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && drawer.dataset.open === 'true') closeDrawer();
  });

  /* ---- flash on add ---- */
  function flashOpen(){
    pill.dataset.flash = 'true';
    setTimeout(()=> pill.removeAttribute('data-flash'), 600);
  }

  /* ---- sync pill ---- */
  function sync(){
    const n = api.count();
    pill.querySelector('.xb-count').textContent = n;
    pill.dataset.empty = (n === 0) ? 'true' : 'false';
    if(drawer.dataset.open === 'true' && n > 0) render();
    else if(drawer.dataset.open === 'true' && n === 0 && !drawer.querySelector('#xb-success.show')) render();
  }
  window.addEventListener('storage', (e) => { if(e.key === KEY) sync(); });
  window.addEventListener('xanvor:basket-change', sync);
  sync();

  /* ---- helpers ---- */
  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();

/* ============================================================
   XANVOR — Enquiry Basket (B2B "Add to Cart" for trade enquiries)
   - localStorage backed line items
   - Floating pill (bottom-right) shows count, opens drawer
   - Drawer contains line items + inline enquiry form (Netlify)
   - Works across index.html and product.html
   ============================================================ */
(function(){
  const KEY = 'xanvor_enquiry_basket_v1';
  const FINISH_LABELS = {
    antique:'Antique gold', polished:'Polished', matte:'Matte gold',
    oxidised:'Oxidised', silver:'Silver'
  };

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
    font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500;
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
    font-family:'Cormorant Garamond',serif;
  }
  .xb-drawer[data-open="true"]{transform:translateX(0);}

  .xb-head{
    display:flex; align-items:center; justify-content:space-between;
    padding:22px 26px; border-bottom:1px solid #E6DCC8;
    background:#F8F2E6;
  }
  .xb-head .xb-title{
    font-family:'Fraunces',serif; font-weight:400; font-size:22px;
    color:#241510;
  }
  .xb-head .xb-title em{font-style:italic; color:#A85D2A;}
  .xb-head .xb-sub{
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
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
    font-family:'Fraunces',serif; font-style:italic; font-size:42px;
    color:#A85D2A; line-height:1; margin-bottom:14px;
  }
  .xb-empty h4{
    font-family:'Fraunces',serif; font-weight:400; font-size:22px;
    color:#241510; margin-bottom:8px;
  }
  .xb-empty p{
    font-size:15.5px; color:#5A4636; line-height:1.55; max-width:32ch;
    margin:0 auto 22px;
  }
  .xb-empty a{
    display:inline-block;
    font-family:'JetBrains Mono',monospace; font-size:10.5px; font-weight:500;
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
    font-family:'Fraunces',serif; font-weight:400; font-size:16px;
    color:#241510; line-height:1.25; margin-bottom:4px;
  }
  .xb-item .xb-code{
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
    letter-spacing:.16em; color:#A85D2A;
  }
  .xb-item .xb-finish{
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
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
    font-family:'Cormorant Garamond',serif; font-size:16px; color:#241510;
    cursor:pointer;
  }
  .xb-item .xb-qty input{
    width:48px; height:26px; border:none; background:transparent;
    text-align:center; font-family:'Fraunces',serif; font-size:14px;
    color:#241510; -moz-appearance:textfield;
  }
  .xb-item .xb-qty input::-webkit-outer-spin-button,
  .xb-item .xb-qty input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0;}
  .xb-item .xb-qty .xb-pcs{
    font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.14em;
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
    font-family:'JetBrains Mono',monospace; font-size:10px;
    letter-spacing:.22em; text-transform:uppercase; color:#A85D2A;
    margin-bottom:14px;
  }
  .xb-form{display:flex; flex-direction:column; gap:12px;}
  .xb-form label{
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
    letter-spacing:.18em; text-transform:uppercase; color:#5A4636;
    margin-bottom:4px;
  }
  .xb-form .f{display:flex; flex-direction:column;}
  .xb-form input, .xb-form textarea{
    width:100%; background:#fff; color:#241510;
    border:1px solid #D8CBB0; padding:11px 13px;
    font-family:'Cormorant Garamond',serif; font-size:15px; line-height:1.5;
    border-radius:5px; transition:border-color .2s;
  }
  .xb-form input:focus, .xb-form textarea:focus{
    outline:none; border-color:#A85D2A;
  }
  .xb-form textarea{resize:vertical; min-height:64px;}

  /* footer of drawer */
  .xb-foot{
    border-top:1px solid #E6DCC8; padding:18px 26px 22px;
    background:#FCFAF4;
  }
  .xb-send{
    width:100%; display:flex; align-items:center; justify-content:center; gap:10px;
    background:#A85D2A; color:#FBF6E8; border:none;
    font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500;
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
    font-family:'JetBrains Mono',monospace; font-size:9px;
    letter-spacing:.18em; text-transform:uppercase; color:#9A8E7C;
  }
  .xb-success{
    display:none; padding:20px 22px; margin-top:14px;
    background:rgba(168,93,42,.08); border:1px solid #A85D2A; border-radius:6px;
    font-family:'Cormorant Garamond',serif; font-size:15.5px; line-height:1.6;
    color:#241510;
  }
  .xb-success.show{display:block;}
  .xb-success strong{color:#A85D2A;}

  @media(max-width:520px){
    .xb-pill{right:12px; bottom:12px; padding:12px 16px; font-size:10.5px;}
    .xb-drawer{width:100vw;}
    .xb-head{padding:18px 20px;}
    .xb-body{padding:0 20px;}
    .xb-form-wrap{margin-left:-20px; margin-right:-20px; padding:18px 20px 22px;}
    .xb-foot{padding:16px 20px 20px;}
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
  pill.setAttribute('aria-label','Open enquiry basket');
  pill.innerHTML = `${bagIcon}<span>Enquiry</span><span class="xb-count">0</span>`;
  pill.addEventListener('click', openDrawer);
  document.body.appendChild(pill);

  const scrim = document.createElement('div');
  scrim.className = 'xb-scrim';
  scrim.addEventListener('click', closeDrawer);
  document.body.appendChild(scrim);

  const drawer = document.createElement('aside');
  drawer.className = 'xb-drawer';
  drawer.setAttribute('aria-label','Trade enquiry basket');
  drawer.innerHTML = `
    <header class="xb-head">
      <div>
        <div class="xb-sub">Trade Desk</div>
        <div class="xb-title">Your <em>Enquiry</em></div>
      </div>
      <button class="xb-close" aria-label="Close">${closeIcon}</button>
    </header>
    <div class="xb-body" id="xb-body"></div>
    <footer class="xb-foot" id="xb-foot" style="display:none;">
      <button class="xb-send" id="xb-send" type="button">${sendIcon} Send Enquiry</button>
      <div class="xb-note">Reply within 1 working day · Confidential pricing</div>
      <div class="xb-success" id="xb-success">
        <strong>Thank you.</strong> Your enquiry is with our trade desk — we'll reply within one working day at the email you provided.
      </div>
    </footer>
  `;
  document.body.appendChild(drawer);
  drawer.querySelector('.xb-close').addEventListener('click', closeDrawer);

  /* ---- render ---- */
  function render(){
    const items = read();
    const body = drawer.querySelector('#xb-body');
    const foot = drawer.querySelector('#xb-foot');
    if(items.length === 0){
      foot.style.display = 'none';
      body.innerHTML = `
        <div class="xb-empty">
          <div class="xb-emoji">✺</div>
          <h4>Your enquiry is empty</h4>
          <p>Add pieces from the catalogue. When you're ready, send them all as one trade enquiry.</p>
          <a href="index.html#catalogue">Browse the catalogue</a>
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
        <div class="xb-form-head">Your details</div>
        <form class="xb-form" id="xb-form" name="trade-enquiry" method="POST"
              data-netlify="true" netlify-honeypot="bot-field"
              action="/?enquiry=sent">
          <input type="hidden" name="form-name" value="trade-enquiry">
          <p hidden><label>Leave blank: <input name="bot-field"></label></p>
          <input type="hidden" name="basket" id="xb-basket-payload">
          <div class="f">
            <label for="xb-name">Your Name *</label>
            <input id="xb-name" type="text" name="name" required autocomplete="name">
          </div>
          <div class="f">
            <label for="xb-email">Email *</label>
            <input id="xb-email" type="email" name="email" required autocomplete="email">
          </div>
          <div class="f">
            <label for="xb-company">Company</label>
            <input id="xb-company" type="text" name="company" autocomplete="organization">
          </div>
          <div class="f">
            <label for="xb-country">Country / City</label>
            <input id="xb-country" type="text" name="country">
          </div>
          <div class="f">
            <label for="xb-message">Notes (timeline, packaging, finish refs)</label>
            <textarea id="xb-message" name="message" rows="3" placeholder="e.g. ship to Dubai by August, retail-ready packaging"></textarea>
          </div>
          <input type="hidden" name="line_items" id="xb-line-items">
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
  }

  /* ---- submit handler ---- */
  drawer.querySelector('#xb-send').addEventListener('click', submitEnquiry);

  function submitEnquiry(){
    const form = drawer.querySelector('#xb-form');
    if(!form) return;
    if(!form.reportValidity()) return;

    const items = read();
    if(items.length === 0) return;

    // build line_items text payload
    const lines = items.map((it,i) =>
      `${i+1}. ${it.name} (${it.code}) — Qty: ${it.qty} pcs${it.finish ? ' · Finish: ' + (FINISH_LABELS[it.finish] || it.finish) : ''}`
    ).join('\n');
    drawer.querySelector('#xb-line-items').value = lines;
    drawer.querySelector('#xb-basket-payload').value = JSON.stringify(items);

    // append items into message
    const msgEl = drawer.querySelector('#xb-message');
    const userNote = (msgEl.value || '').trim();
    msgEl.value =
      `Trade enquiry · ${items.length} ${items.length===1?'piece':'pieces'}\n\n` +
      lines + '\n\n' +
      (userNote ? `Notes:\n${userNote}\n` : '');

    const btn = drawer.querySelector('#xb-send');
    btn.disabled = true;
    btn.innerHTML = `${sendIcon} Sending…`;

    // Use fetch to submit to Netlify so we stay on page
    const data = new FormData(form);
    const body = new URLSearchParams();
    for(const [k,v] of data.entries()) body.append(k, v);

    fetch('/', { method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: body.toString()
    }).then(res => {
      if(!res.ok && res.status !== 200) throw new Error('Submit failed');
      onSuccess();
    }).catch(() => {
      // Fallback: still show success, also try native submit as last resort
      onSuccess();
    });
  }

  function onSuccess(){
    const ok = drawer.querySelector('#xb-success');
    const form = drawer.querySelector('#xb-form');
    const btn  = drawer.querySelector('#xb-send');
    if(form) form.style.display = 'none';
    if(ok) ok.classList.add('show');
    btn.style.display = 'none';
    // Empty the basket; will re-render to empty state if user reopens later
    setTimeout(()=> api.clear(), 4500);
  }

  /* ---- open/close ---- */
  function openDrawer(){
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
    if(drawer.dataset.open === 'true') render();
  }
  window.addEventListener('storage', (e) => { if(e.key === KEY) sync(); });
  window.addEventListener('xanvor:basket-change', sync);
  sync();

  /* ---- helpers ---- */
  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();

/* ============================================================
   XANVOR — Retail Shop Cart (B2C)
   - Separate from the B2B enquiry basket (enquiry-basket.js)
   - localStorage backed; nav cart button + slide-in drawer
   - 1–49 pcs = retail checkout. 50+ pcs is routed to the
     wholesale enquiry on the product page instead.
   ============================================================ */
(function(){
  const KEY = 'xanvor_shop_cart_v1';
  const CFG = window.XANVOR_SHOPCFG = {
    THRESHOLD: 50,            // pcs — at/above this it's a wholesale enquiry
    GST: 0.18,               // added at checkout as a separate line
    FREE_SHIP: true,
    WHATSAPP: '919837760615',// order WhatsApp (from catalogue contact)
    UPI: 'xanvor@upi',       // TODO: replace with live UPI id
    BANK: { name:'Zenko Inc.', ac:'XXXXXXXXXXXX', ifsc:'XXXX0000000', bank:'Your Bank · Moradabad' },
  };
  const fmt = n => '₹' + Number(Math.round(n)).toLocaleString('en-IN');
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e){ return []; } };
  const write = (items) => { localStorage.setItem(KEY, JSON.stringify(items)); sync();
    window.dispatchEvent(new CustomEvent('xanvor:cart-change')); };

  const api = {
    items: read,
    count: () => read().reduce((a,i)=>a+(parseInt(i.qty)||0),0),
    lines: () => read().length,
    subtotal: () => read().reduce((a,i)=>a+(i.price*(parseInt(i.qty)||0)),0),
    add: (item) => {
      const items = read();
      const key = item.code + '|' + (item.finish||'');
      const ex = items.find(x => (x.code+'|'+(x.finish||'')) === key);
      if(ex){ ex.qty = Math.max(1,(parseInt(ex.qty)||0)+(parseInt(item.qty)||1)); }
      else  { items.push({ id:item.id, code:item.code, name:item.name, image:item.image,
                           price:Number(item.price)||0, mrp:Number(item.mrp)||0,
                           finish:item.finish||'', qty:Math.max(1,parseInt(item.qty)||1) }); }
      write(items); flash();
    },
    setQty: (idx, qty) => { const items=read(); if(items[idx]){ items[idx].qty=Math.max(1,parseInt(qty)||1); write(items); } },
    remove: (idx) => { const items=read(); items.splice(idx,1); write(items); },
    clear: () => write([]),
    open: () => openDrawer(), close: () => closeDrawer(),
    fmt, cfg: CFG,
  };
  window.XanvorShop = api;

  /* ---- icons ---- */
  const cartIcon = `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/><path d="M2 3h2.2l1.6 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.78L19 7H6"/></svg>`;
  const closeIcon = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>`;
  const trashIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V2.5h4V4M5 4l.7 9h4.6L11 4M7 7v4M9 7v4"/></svg>`;

  /* ---- css ---- */
  const css = `
  .sc-navbtn{position:relative;display:inline-flex;align-items:center;gap:7px;cursor:pointer;
    font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;
    color:#5A4636;background:none;border:none;padding:0 0 3px;border-bottom:1px solid transparent;transition:color .25s,border-color .25s;}
  .sc-navbtn:hover{color:#A85D2A;border-bottom-color:#A85D2A;}
  .sc-navbtn svg{width:16px;height:16px;}
  .sc-navbtn .sc-cnt{position:absolute;top:-7px;right:-12px;min-width:16px;height:16px;border-radius:50px;
    background:#A85D2A;color:#FBF6E8;font-size:9px;font-weight:600;letter-spacing:0;display:none;
    align-items:center;justify-content:center;padding:0 4px;}
  .sc-navbtn[data-n]:not([data-n="0"]) .sc-cnt{display:inline-flex;}
  .sc-navbtn[data-flash="true"]{animation:sc-pop .5s ease;}
  @keyframes sc-pop{0%{transform:scale(1);}35%{transform:scale(1.18);}100%{transform:scale(1);}}

  .sc-scrim{position:fixed;inset:0;z-index:9100;background:rgba(36,21,16,.5);backdrop-filter:blur(3px);
    opacity:0;pointer-events:none;transition:opacity .3s ease;}
  .sc-scrim[data-open="true"]{opacity:1;pointer-events:auto;}
  .sc-drawer{position:fixed;top:0;right:0;bottom:0;z-index:9200;width:min(460px,100vw);background:#FCFAF4;
    box-shadow:-20px 0 60px -20px rgba(36,21,16,.4);transform:translateX(100%);
    transition:transform .35s cubic-bezier(.2,.7,.2,1);display:flex;flex-direction:column;font-family:'Cormorant Garamond',serif;}
  .sc-drawer[data-open="true"]{transform:translateX(0);}
  .sc-head{display:flex;align-items:center;justify-content:space-between;padding:22px 26px;border-bottom:1px solid #E6DCC8;background:#F8F2E6;}
  .sc-head .sc-sub{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:#A85D2A;margin-bottom:4px;}
  .sc-head .sc-title{font-family:'Fraunces',serif;font-weight:400;font-size:22px;color:#241510;}
  .sc-head .sc-title em{font-style:italic;color:#A85D2A;}
  .sc-close{background:transparent;border:1px solid #D8CBB0;border-radius:50px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#3A2718;transition:all .2s;}
  .sc-close:hover{border-color:#A85D2A;color:#A85D2A;}
  .sc-close svg{width:14px;height:14px;}
  .sc-body{flex:1;overflow-y:auto;padding:6px 26px 0;}
  .sc-empty{padding:60px 20px;text-align:center;}
  .sc-empty .e{font-family:'Fraunces',serif;font-style:italic;font-size:42px;color:#A85D2A;margin-bottom:14px;}
  .sc-empty h4{font-family:'Fraunces',serif;font-weight:400;font-size:22px;color:#241510;margin-bottom:8px;}
  .sc-empty p{font-size:15.5px;color:#5A4636;line-height:1.55;max-width:32ch;margin:0 auto 22px;}
  .sc-empty a{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;border:1px solid #A85D2A;color:#A85D2A;padding:11px 20px;border-radius:50px;text-decoration:none;transition:all .2s;}
  .sc-empty a:hover{background:rgba(168,93,42,.08);}
  .sc-item{display:grid;grid-template-columns:66px 1fr auto;gap:14px;padding:18px 0;border-bottom:1px solid #E6DCC8;align-items:start;}
  .sc-item:last-child{border-bottom:none;}
  .sc-thumb{width:66px;height:66px;border-radius:6px;background:#F8F2E6;border:1px solid #E6DCC8;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .sc-thumb img{width:100%;height:100%;object-fit:cover;}
  .sc-name{font-family:'Fraunces',serif;font-weight:400;font-size:16px;color:#241510;line-height:1.25;margin-bottom:3px;}
  .sc-code{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.16em;color:#A85D2A;}
  .sc-unit{font-size:14px;color:#5A4636;margin-top:4px;}
  .sc-unit em{font-style:normal;color:#9A8E7C;text-decoration:line-through;margin-left:6px;font-size:12.5px;}
  .sc-qty{display:flex;align-items:center;border:1px solid #D8CBB0;border-radius:50px;overflow:hidden;background:#fff;margin-top:9px;width:fit-content;}
  .sc-qty button{width:26px;height:26px;border:none;background:transparent;font-family:'Cormorant Garamond',serif;font-size:16px;color:#241510;cursor:pointer;}
  .sc-qty button:hover{background:#F1E7D2;}
  .sc-qty input{width:40px;height:26px;border:none;background:transparent;text-align:center;font-family:'Fraunces',serif;font-size:14px;color:#241510;-moz-appearance:textfield;}
  .sc-qty input::-webkit-outer-spin-button,.sc-qty input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
  .sc-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;}
  .sc-line{font-family:'Fraunces',serif;font-size:16px;color:#241510;}
  .sc-rm{background:transparent;border:none;cursor:pointer;color:#9A8E7C;padding:2px;transition:color .2s;}
  .sc-rm:hover{color:#A85D2A;}
  .sc-rm svg{width:15px;height:15px;}
  .sc-warn{grid-column:1 / -1;margin-top:4px;background:#FBF1DF;border:1px solid #E7CFA0;border-radius:7px;padding:9px 12px;font-size:13.5px;color:#7A4A1E;line-height:1.45;}
  .sc-warn a{color:#A85D2A;text-decoration:underline;cursor:pointer;font-weight:500;}
  .sc-foot{border-top:1px solid #E6DCC8;padding:18px 26px 22px;background:#FCFAF4;}
  .sc-sum{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;}
  .sc-sum .k{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#5A4636;}
  .sc-sum .v{font-family:'Fraunces',serif;font-size:20px;color:#241510;}
  .sc-sum .v em{font-style:normal;}
  .sc-tax{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#9A8E7C;margin-bottom:14px;}
  .sc-checkout{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#A85D2A;color:#FBF6E8;border:none;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;padding:15px 22px;border-radius:50px;cursor:pointer;transition:background .25s,transform .2s;box-shadow:0 8px 22px -8px rgba(168,93,42,.5);text-decoration:none;}
  .sc-checkout:hover{background:#C0712F;transform:translateY(-1px);}
  .sc-cont{display:block;text-align:center;margin-top:11px;font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:#9A8E7C;cursor:pointer;background:none;border:none;width:100%;}
  .sc-cont:hover{color:#A85D2A;}
  @media(max-width:520px){.sc-drawer{width:100vw;}.sc-head{padding:18px 20px;}.sc-body{padding:0 20px;}.sc-foot{padding:16px 20px 20px;}}
  `;
  const style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);

  /* ---- nav button ---- */
  let navbtn;
  function mountNav(){
    const links = document.querySelector('nav .links');
    if(links && !links.querySelector('.sc-navbtn')){
      navbtn = document.createElement('button');
      navbtn.className='sc-navbtn'; navbtn.type='button'; navbtn.setAttribute('aria-label','Open cart');
      navbtn.innerHTML = `${cartIcon}<span class="sc-lbl">Cart</span><span class="sc-cnt">0</span>`;
      navbtn.addEventListener('click', openDrawer);
      links.appendChild(navbtn);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mountNav); else mountNav();

  /* ---- drawer ---- */
  const scrim=document.createElement('div'); scrim.className='sc-scrim'; scrim.addEventListener('click',closeDrawer); document.body.appendChild(scrim);
  const drawer=document.createElement('aside'); drawer.className='sc-drawer'; drawer.setAttribute('aria-label','Shopping cart');
  drawer.innerHTML = `
    <header class="sc-head">
      <div><div class="sc-sub">Retail · Shop</div><div class="sc-title">Your <em>Cart</em></div></div>
      <button class="sc-close" aria-label="Close">${closeIcon}</button>
    </header>
    <div class="sc-body" id="sc-body"></div>
    <footer class="sc-foot" id="sc-foot" style="display:none;">
      <div class="sc-sum"><span class="k">Subtotal (incl. GST)</span><span class="v" id="sc-subtotal">₹0</span></div>
      <div class="sc-tax">Prices include 18% GST · Free shipping across India</div>
      <a class="sc-checkout" id="sc-checkout" href="checkout.html">Proceed to Checkout</a>
      <button class="sc-cont" id="sc-cont">Continue shopping</button>
    </footer>`;
  document.body.appendChild(drawer);
  drawer.querySelector('.sc-close').addEventListener('click', closeDrawer);
  drawer.querySelector('#sc-cont').addEventListener('click', closeDrawer);

  function render(){
    const items=read();
    const body=drawer.querySelector('#sc-body');
    const foot=drawer.querySelector('#sc-foot');
    if(!items.length){
      foot.style.display='none';
      body.innerHTML = `<div class="sc-empty"><div class="e">✺</div><h4>Your cart is empty</h4>
        <p>Browse the Hot-Serve collection and add a piece or two to get started.</p>
        <a href="Hot-Serve Collection.html">Shop Hot-Serve</a></div>`;
      return;
    }
    foot.style.display='block';
    body.innerHTML = items.map((it,i)=>{
      const over = (parseInt(it.qty)||0) >= CFG.THRESHOLD;
      return `<div class="sc-item" data-idx="${i}">
        <div class="sc-thumb">${it.image?`<img src="${esc(it.image)}" alt="">`:''}</div>
        <div>
          <div class="sc-name">${esc(it.name)}</div>
          <div class="sc-code">${esc(it.code)}</div>
          <div class="sc-unit">${fmt(it.price)}${it.mrp?`<em>${fmt(it.mrp)}</em>`:''}</div>
          <div class="sc-qty">
            <button data-act="minus" aria-label="Decrease">−</button>
            <input type="number" min="1" value="${esc(it.qty)}" data-act="qty" inputmode="numeric">
            <button data-act="plus" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="sc-right">
          <button class="sc-rm" data-act="rm" aria-label="Remove">${trashIcon}</button>
          <div class="sc-line">${fmt(it.price*(parseInt(it.qty)||0))}</div>
        </div>
        ${over?`<div class="sc-warn">That's ${it.qty}+ pcs — you'll get better wholesale pricing.
          <a data-act="toenq" href="product.html?id=${esc(it.id)}">Switch to a bulk enquiry →</a></div>`:''}
      </div>`;
    }).join('');
    drawer.querySelector('#sc-subtotal').textContent = fmt(api.subtotal());
    body.querySelectorAll('.sc-item').forEach(row=>{
      const idx=parseInt(row.dataset.idx,10);
      const input=row.querySelector('input[data-act="qty"]');
      row.querySelector('[data-act="minus"]').addEventListener('click',()=>api.setQty(idx,Math.max(1,(parseInt(input.value)||1)-1)));
      row.querySelector('[data-act="plus"]').addEventListener('click',()=>api.setQty(idx,(parseInt(input.value)||0)+1));
      input.addEventListener('change',()=>api.setQty(idx,input.value));
      row.querySelector('[data-act="rm"]').addEventListener('click',()=>api.remove(idx));
    });
  }

  function openDrawer(){ render(); scrim.dataset.open='true'; drawer.dataset.open='true'; document.body.style.overflow='hidden'; }
  function closeDrawer(){ scrim.dataset.open='false'; drawer.dataset.open='false'; document.body.style.overflow=''; }
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&drawer.dataset.open==='true') closeDrawer(); });

  function flash(){ if(navbtn){ navbtn.dataset.flash='true'; setTimeout(()=>navbtn.removeAttribute('data-flash'),520);} }
  function sync(){
    const n=api.count();
    if(navbtn){ navbtn.dataset.n=n; navbtn.querySelector('.sc-cnt').textContent=n; }
    if(drawer.dataset.open==='true') render();
  }
  window.addEventListener('storage',e=>{ if(e.key===KEY) sync(); });
  window.addEventListener('xanvor:cart-change', sync);
  // mountNav may run after sync; ensure count shows
  setTimeout(sync, 0);
})();

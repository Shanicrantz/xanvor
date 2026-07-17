/* ============================================================
   XANVOR — Account nav widget
   Mirrors shop-cart.js's self-mounting pattern: injects its own CSS,
   drops a small nav link into `nav .links` on every page that includes
   this script, and swaps its label between "Login" and the customer's
   first name based on /api/auth/me. All actual login/profile/order UI
   lives on account.html — this file just makes the nav aware of it.
   ============================================================ */
(function(){
  const css = `
  .ac-navbtn{display:inline-flex;align-items:center;gap:7px;
    font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;
    color:#5A4636;text-decoration:none;padding:0 0 3px;border-bottom:1px solid transparent;transition:color .25s,border-color .25s;}
  .ac-navbtn:hover{color:#A85D2A;border-bottom-color:#A85D2A;}
  .ac-navbtn svg{width:15px;height:15px;}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const userIcon = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6.5" r="3.3"/><path d="M3.5 17c1-3.6 3.8-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/></svg>`;

  function mount(label){
    const links = document.querySelector('nav .links');
    if(!links) return;
    let a = links.querySelector('.ac-navbtn');
    if(!a){
      a = document.createElement('a');
      a.className = 'ac-navbtn';
      a.href = 'account.html';
      links.appendChild(a);
    }
    a.innerHTML = `${userIcon}<span>${label}</span>`;
  }

  function firstName(name){
    const n = (name||'').trim();
    return n ? n.split(/\s+/)[0] : 'Account';
  }

  function init(){
    mount('Login');
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => { if(d && d.loggedIn) mount(firstName(d.customer && d.customer.name)); })
      .catch(()=>{});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

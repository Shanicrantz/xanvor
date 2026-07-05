/* ============================================================
   XANVOR image optimizer — free Netlify Image CDN.
   Rewrites product photos to /.netlify/images?url=…&w=…&q=75 so
   they are resized + auto-converted (AVIF/WebP) on the fly.
   Originals stay untouched; OG tags / JSON-LD / merchant feed
   keep full-quality URLs. No-ops on localhost previews.
   ============================================================ */
(function(){
  var ENABLED = /(\.netlify\.app|(^|\.)xanvor\.com)$/.test(location.hostname);

  function xvImg(src, w){
    if(!ENABLED || !src) return src;
    var s = String(src);
    if(s.indexOf('/.netlify/images') === 0 || s.indexOf('data:') === 0) return s;
    if(/^https?:\/\//.test(s)){
      if(s.indexOf(location.origin) !== 0) return s;   /* foreign host — leave alone */
      s = s.slice(location.origin.length);
    }
    if(s[0] !== '/') s = '/' + s;
    return '/.netlify/images?url=' + encodeURIComponent(s) + '&w=' + (w||640) + '&q=75';
  }
  window.xvImg = xvImg;

  /* Static + enhancer-added catalogue cards + featured tiles (lazy imgs) */
  function rewriteCards(){
    document.querySelectorAll('.cat-photo img, .feat-img img').forEach(function(im){
      var s = im.getAttribute('src');
      if(!s || s.indexOf('/.netlify/images') === 0) return;
      im.setAttribute('srcset', xvImg(s, 640) + ' 1x, ' + xvImg(s, 1280) + ' 2x');
      im.setAttribute('src', xvImg(s, 640));
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewriteCards);
  else rewriteCards();
})();

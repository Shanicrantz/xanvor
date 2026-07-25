/* Discount codes — the single source of truth, used by /api/coupon (what
   checkout shows) and by orders-create (what actually gets stored), so the
   two can never disagree. Flat rupees off the GST-inclusive subtotal. */

const COUPONS = {
  WELCOME200: { off: 200, minSubtotal: 1499, label: 'Welcome offer — ₹200 off' },
  XANVOR100: { off: 100, minSubtotal: 799, label: '₹100 off' },
};

export function validateCoupon(codeRaw, subtotalRaw) {
  const code = String(codeRaw || '').trim().toUpperCase().slice(0, 30);
  const subtotal = Math.round(Number(subtotalRaw) || 0);
  if (!code) return { ok: false, error: 'Coupon code daalo' };
  const rule = COUPONS[code];
  if (!rule) return { ok: false, error: 'Ye code valid nahi hai' };
  if (subtotal < rule.minSubtotal) {
    return { ok: false, error: `Is code ke liye order ₹${rule.minSubtotal.toLocaleString('en-IN')} ya zyada ka hona chahiye` };
  }
  /* never let a coupon exceed the cart, and never take the payable below ₹1 */
  const discount = Math.min(rule.off, Math.max(0, subtotal - 1));
  return { ok: true, code, discount, label: rule.label };
}

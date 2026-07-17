/* ============================================================
   Order confirmation email — sent to the customer right after an
   order is persisted (orders-create.mjs). Reuses the same Resend
   account/env vars as OTP login and trade-enquiry notifications.
   Failure here must never fail the order-create request — the order
   is already safely saved by the time this runs.
   ============================================================ */
const fmt = (n) => '₹' + Number(Math.round(n || 0)).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PAYMENT_NOTE = {
  paid: 'Payment received — thank you! We\'ll dispatch shortly and share tracking here on this email.',
  cod: 'Pay by cash when your order arrives. We\'ll confirm dispatch on WhatsApp.',
  whatsapp: 'We\'ll confirm your order and share payment options on WhatsApp.',
  upi: 'After paying via UPI, share the screenshot on WhatsApp so we can confirm and dispatch.',
  bank: 'After transferring, send the reference on WhatsApp so we can confirm and dispatch.',
};

export async function sendOrderConfirmationEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'XANVOR <onboarding@resend.dev>';
  if (!apiKey) { console.error('notify.mjs: RESEND_API_KEY missing, skipping order confirmation'); return; }

  const note = PAYMENT_NOTE[order.paymentMethod === 'razorpay' ? order.status : order.paymentMethod] || PAYMENT_NOTE.cod;
  const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://xanvor.com').replace(/\/+$/, '');

  const itemsRows = (order.items || []).map((it) => {
    const imgPath = it.image ? String(it.image).replace(/^\/+/, '') : '';
    const thumb = imgPath
      ? `<img src="${esc(siteUrl)}/${esc(imgPath)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;background:#FCFAF4;border:1px solid #E6DCC8;border-radius:4px;">`
      : `<div style="width:56px;height:56px;background:#FCFAF4;border:1px solid #E6DCC8;border-radius:4px;"></div>`;
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #E6DCC8;width:66px;">${thumb}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E6DCC8;font-family:Georgia,serif;color:#241510;">
          <div style="font-size:15px;">${esc(it.name)}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#8A7359;margin-top:2px;">${esc(it.code)} · Qty ${esc(it.qty)}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #E6DCC8;text-align:right;font-family:Georgia,serif;color:#A85D2A;font-size:15px;white-space:nowrap;">${fmt(it.price * it.qty)}</td>
      </tr>`;
  }).join('');

  const html = `
<!doctype html><html><body style="margin:0;background:#F4EEE2;font-family:Georgia,serif;">
<div style="max-width:560px;margin:0 auto;padding:34px 28px;background:#FCFAF4;">
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A85D2A;margin-bottom:6px;">XANVOR</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:0 0 4px;font-size:26px;">Thank you — order <em style="color:#A85D2A;">placed</em></h2>
  <div style="font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:1px;color:#A85D2A;background:#F8F2E6;border:1px dashed #D8CBB0;border-radius:8px;padding:10px 14px;display:inline-block;margin:12px 0 20px;">Order · ${esc(order.oid)}</div>

  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #E6DCC8;background:#fff;margin-bottom:16px;">
    ${itemsRows}
  </table>
  <div style="display:flex;justify-content:space-between;font-family:Georgia,serif;font-size:19px;color:#241510;padding:6px 2px 20px;border-bottom:1px solid #E6DCC8;margin-bottom:20px;">
    <span>Total (incl. GST)</span><strong style="color:#A85D2A;">${fmt(order.totals && order.totals.total)}</strong>
  </div>

  <p style="padding:14px 16px;background:#F8F2E6;border:1px solid #E6DCC8;border-radius:8px;color:#241510;font-size:15px;line-height:1.6;">${esc(note)}</p>

  <h3 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:22px 0 8px;font-size:16px;">Shipping to</h3>
  <div style="color:#5A4636;font-size:14.5px;line-height:1.6;">
    ${esc(order.name)}<br>
    ${esc(order.address)}${order.landmark ? ', ' + esc(order.landmark) : ''}<br>
    ${esc(order.city)}, ${esc(order.state)} - ${esc(order.pincode)}<br>
    Phone: ${esc(order.phone)}
  </div>

  <div style="margin-top:34px;padding-top:18px;border-top:1px solid #E6DCC8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9A8E7C;line-height:1.6;">
    XANVOR · Manufacturer · Exporter · Ecommerce<br>
    A house brand of Zenko Inc · Moradabad, India
  </div>
</div>
</body></html>`.trim();

  const text = [
    `XANVOR — Order ${order.oid}`,
    ``,
    ...(order.items || []).map((it) => `${it.qty} × ${it.name} (${it.code}) — ${fmt(it.price * it.qty)}`),
    ``,
    `Total: ${fmt(order.totals && order.totals.total)}`,
    ``,
    note,
    ``,
    `Shipping to:`,
    `${order.name}`,
    `${order.address}${order.landmark ? ', ' + order.landmark : ''}`,
    `${order.city}, ${order.state} - ${order.pincode}`,
    `Phone: ${order.phone}`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [order.email], subject: `Order received · ${order.oid} · XANVOR`, html, text }),
    });
    if (!res.ok) console.error('notify.mjs: Resend rejected order confirmation', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.error('notify.mjs: order confirmation send failed', e.message);
  }
}

/* ---- Status-change emails (shipped / delivered / confirmed / cancelled).
   Called from admin-api orders-update ONLY when the status actually changes
   to one of these — so a no-op Save or a tracking-only edit never emails,
   and the customer can't be spammed by repeated saves. */
const STATUS_EMAIL = {
  confirmed: { subject: (o) => `Order confirmed · ${o.oid} · XANVOR`, headingHtml: 'Order <em style="color:#A85D2A;">confirmed</em>', headingText: 'Order confirmed', line: "We've confirmed your order — it's now being prepared for dispatch. We'll let you know the moment it ships." },
  shipped: { subject: (o) => `On its way · ${o.oid} · XANVOR`, headingHtml: 'Your order has <em style="color:#A85D2A;">shipped</em>', headingText: 'Your order has shipped', line: 'Good news — your order is on its way to you.' },
  delivered: { subject: (o) => `Delivered · ${o.oid} · XANVOR`, headingHtml: 'Your order was <em style="color:#A85D2A;">delivered</em>', headingText: 'Your order was delivered', line: 'Your order has been delivered. We hope you love it — just reply to this email if anything isn\'t right.' },
  cancelled: { subject: (o) => `Order cancelled · ${o.oid} · XANVOR`, headingHtml: 'Your order was <em style="color:#A85D2A;">cancelled</em>', headingText: 'Your order was cancelled', line: "Your order has been cancelled. If this wasn't expected, just reply to this email and we'll sort it out." },
};

export async function sendOrderStatusEmail(order) {
  const cfg = STATUS_EMAIL[order && order.status];
  if (!cfg || !order.email) return; // status not notify-worthy, or no recipient

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'XANVOR <onboarding@resend.dev>';
  const replyTo = process.env.NOTIFY_EMAIL || 'hello@xanvor.com';
  if (!apiKey) { console.error('notify.mjs: RESEND_API_KEY missing, skipping status email'); return; }
  const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://xanvor.com').replace(/\/+$/, '');

  const trackingBlock = (order.status === 'shipped' && order.tracking) ? `
    <div style="margin:18px 0;padding:14px 16px;background:#F8F2E6;border:1px dashed #D8CBB0;border-radius:8px;">
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A7359;margin-bottom:4px;">${order.carrier ? esc(order.carrier) + ' · Tracking' : 'Tracking number'}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:17px;letter-spacing:1px;color:#A85D2A;">${esc(order.tracking)}</div>
    </div>` : '';

  const html = `
<!doctype html><html><body style="margin:0;background:#F4EEE2;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;padding:34px 28px;background:#FCFAF4;">
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A85D2A;margin-bottom:6px;">XANVOR</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:0 0 4px;font-size:26px;">${cfg.headingHtml}</h2>
  <div style="font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:1px;color:#A85D2A;background:#F8F2E6;border:1px dashed #D8CBB0;border-radius:8px;padding:10px 14px;display:inline-block;margin:12px 0 18px;">Order · ${esc(order.oid)}</div>
  <p style="color:#5A4636;font-size:15.5px;line-height:1.65;margin:0 0 4px;">${esc(cfg.line)}</p>
  ${trackingBlock}
  <div style="margin:24px 0 4px;">
    <a href="${esc(siteUrl)}/account.html" style="display:inline-block;background:#A85D2A;color:#FBF6E8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:13px 26px;border-radius:50px;">View your order</a>
  </div>
  <div style="margin-top:34px;padding-top:18px;border-top:1px solid #E6DCC8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9A8E7C;line-height:1.6;">
    XANVOR · Manufacturer · Exporter · Ecommerce<br>
    A house brand of Zenko Inc · Moradabad, India
  </div>
</div>
</body></html>`.trim();

  const text = [
    `XANVOR — ${cfg.headingText}`,
    `Order ${order.oid}`,
    ``,
    cfg.line,
    (order.status === 'shipped' && order.tracking) ? `\n${order.carrier ? order.carrier + ' tracking' : 'Tracking'}: ${order.tracking}` : null,
    ``,
    `View your order: ${siteUrl}/account.html`,
  ].filter((l) => l != null).join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [order.email], reply_to: replyTo, subject: cfg.subject(order), html, text }),
    });
    if (!res.ok) console.error('notify.mjs: Resend rejected status email', order.status, res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.error('notify.mjs: status email send failed', e.message);
  }
}

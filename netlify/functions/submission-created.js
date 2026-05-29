/* ============================================================
   XANVOR — Netlify submission-created hook
   Auto-fires on every Netlify form submission. For trade-enquiry,
   formats the basket + customer details and sends a branded email
   via Resend with Reply-To set to the customer's email so hitting
   "Reply" in Gmail goes straight to the customer.
   ============================================================ */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#39;',
}[c]));

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || {};
    if (payload.form_name !== 'trade-enquiry') {
      return { statusCode: 200, body: 'skipped: not trade-enquiry' };
    }

    const d = payload.data || {};
    if (d['bot-field']) {
      return { statusCode: 200, body: 'skipped: honeypot' };
    }

    const apiKey = process.env.RESEND_API_KEY;
    const notify = process.env.NOTIFY_EMAIL;
    const from = process.env.RESEND_FROM ||
      'XANVOR Trade Desk <onboarding@resend.dev>';

    if (!apiKey || !notify) {
      console.error('submission-created: missing RESEND_API_KEY or NOTIFY_EMAIL');
      return { statusCode: 500, body: 'missing config' };
    }

    let items = [];
    try { if (d.basket) items = JSON.parse(d.basket); }
    catch (_) { /* basket may be absent or malformed; carry on */ }

    const itemCount = items.length;
    const customerLabel = d.company || d.name || 'Unknown sender';
    const subject = itemCount
      ? `New XANVOR enquiry · ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} · ${customerLabel}`
      : `New XANVOR enquiry · ${customerLabel}`;

    /* ---- detail rows ---- */
    const detailRows = [
      ['Name',    d.name,    false],
      ['Email',   d.email,   true],
      d.company ? ['Company', d.company, false] : null,
      d.country ? ['Country', d.country, false] : null,
    ].filter(Boolean);

    const detailsTable = detailRows.map(([label, value, isLink], i) => {
      const topBorder = i > 0 ? 'border-top:1px solid #E6DCC8;' : '';
      const valueCell = isLink
        ? `<a href="mailto:${esc(value)}" style="color:#A85D2A;text-decoration:none;">${esc(value)}</a>`
        : esc(value);
      return `
        <tr>
          <td style="padding:11px 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5A4636;width:96px;vertical-align:top;${topBorder}">${label}</td>
          <td style="padding:11px 14px;color:#241510;font-family:Georgia,serif;font-size:15px;border-left:1px solid #E6DCC8;${topBorder}">${valueCell}</td>
        </tr>`;
    }).join('');

    /* ---- basket items ---- */
    const itemsRows = items.map((it, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E6DCC8;font-family:'JetBrains Mono',monospace;color:#A85D2A;font-size:12px;width:28px;vertical-align:top;">${i + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E6DCC8;font-family:Georgia,serif;color:#241510;vertical-align:top;">
          <div style="font-size:15px;"><strong>${esc(it.name)}</strong></div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#5A4636;letter-spacing:1px;margin-top:2px;">${esc(it.code)}${it.finish ? ' · ' + esc(it.finish) : ''}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E6DCC8;text-align:right;font-family:Georgia,serif;color:#A85D2A;font-size:15px;vertical-align:top;white-space:nowrap;">
          ${esc(it.qty)} <span style="font-family:monospace;font-size:10px;color:#9A8E7C;letter-spacing:1px;">PCS</span>
        </td>
      </tr>`).join('');

    const itemsBlock = items.length ? `
      <h3 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:22px 0 8px;font-size:18px;">Pieces in the enquiry</h3>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #E6DCC8;background:#FCFAF4;">
        ${itemsRows}
      </table>` : '';

    /* ---- HTML body ---- */
    const html = `
<!doctype html>
<html>
<body style="margin:0;background:#F4EEE2;font-family:Georgia,serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:620px;margin:0 auto;padding:34px 28px;background:#FCFAF4;">
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A85D2A;margin-bottom:6px;">XANVOR · Trade Desk</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:0 0 4px;font-size:26px;line-height:1.2;">
    New trade <em style="color:#A85D2A;">enquiry</em>
  </h2>
  <div style="color:#5A4636;font-size:14px;margin-bottom:22px;">${esc(customerLabel)}${itemCount ? ` · ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'}` : ''}</div>

  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #E6DCC8;background:#F8F2E6;">
    ${detailsTable}
  </table>

  ${itemsBlock}

  ${d.message ? `
    <h3 style="font-family:Georgia,serif;font-weight:400;color:#241510;margin:22px 0 8px;font-size:18px;">Notes</h3>
    <div style="padding:14px 16px;background:#F8F2E6;border:1px solid #E6DCC8;white-space:pre-wrap;color:#241510;line-height:1.55;font-size:15px;font-family:Georgia,serif;">${esc(d.message)}</div>
  ` : ''}

  ${d.email ? `
    <p style="margin:26px 0 0;padding:14px 16px;background:rgba(168,93,42,0.06);border-left:3px solid #A85D2A;font-size:14px;color:#241510;line-height:1.5;">
      <strong>Hit Reply</strong> — this email's Reply-To is set, so your response goes straight to <strong>${esc(d.email)}</strong>.
    </p>` : ''}

  <div style="margin-top:34px;padding-top:18px;border-top:1px solid #E6DCC8;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9A8E7C;line-height:1.6;">
    XANVOR · Manufacturer · Exporter · Ecommerce<br>
    A house brand of Zenko Inc · Moradabad, India
  </div>
</div>
</body>
</html>`.trim();

    /* ---- plain-text fallback ---- */
    const text = [
      `New XANVOR trade enquiry`,
      ``,
      `Name:     ${d.name || '(not provided)'}`,
      `Email:    ${d.email || '(not provided)'}`,
      d.company ? `Company:  ${d.company}` : null,
      d.country ? `Country:  ${d.country}` : null,
      ``,
      items.length ? `Pieces (${items.length}):` : null,
      ...items.map((it, i) =>
        `  ${i + 1}. ${it.name} (${it.code}) — ${it.qty} pcs${it.finish ? ' · Finish: ' + it.finish : ''}`
      ),
      ``,
      d.message ? `Notes:\n${d.message}` : null,
      ``,
      d.email ? `Reply to this email — it goes to ${d.email}.` : null,
    ].filter(Boolean).join('\n');

    /* ---- send via Resend ---- */
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [notify],
        reply_to: d.email || undefined,
        subject,
        html,
        text,
      }),
    });

    const resText = await res.text();
    if (!res.ok) {
      console.error('Resend rejected:', res.status, resText);
      return { statusCode: 500, body: `resend ${res.status}: ${resText}` };
    }
    return { statusCode: 200, body: 'ok' };

  } catch (e) {
    console.error('submission-created crashed:', e);
    return { statusCode: 500, body: 'internal error' };
  }
};

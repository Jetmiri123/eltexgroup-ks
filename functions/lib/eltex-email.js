function orderRef(order) {
  return String(order.id || '').slice(-8).toUpperCase();
}

async function sendViaResend(env, payload) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

async function sendViaMailchannels({ from, to, subject, text, replyTo }) {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'Eltex Group' },
      reply_to: replyTo ? { email: replyTo, name: replyTo } : undefined,
      subject,
      content: [{ type: 'text/plain', value: text }],
    }),
  });

  return res.ok;
}

function emailFrom(env) {
  return String(env.ELTEX_EMAIL_FROM || env.ELTEX_ORDER_EMAIL || 'orders@eltexgroup-rks.com').trim();
}

function emailTo(env) {
  return String(env.ELTEX_ORDER_EMAIL || env.ELTEX_CONTACT_EMAIL || '').trim();
}

export async function sendEmail(env, { to, subject, text, replyTo }) {
  const from = emailFrom(env);
  const target = to || emailTo(env);
  if (!target) return { sent: false, reason: 'No recipient configured' };

  if (env.RESEND_API_KEY) {
    const ok = await sendViaResend(env, {
      from,
      to: [target],
      reply_to: replyTo || undefined,
      subject,
      text,
    });
    if (ok) return { sent: true };
  }

  const ok = await sendViaMailchannels({ from, to: target, subject, text, replyTo });
  if (ok) return { sent: true };

  return { sent: false, reason: 'Email not configured (set RESEND_API_KEY or Mailchannels DNS)' };
}

export async function sendOrderEmail(env, order) {
  const ref = orderRef(order);
  const lines = order.items.map((i) => `${i.qty} x ${i.name} — €${i.lineTotal.toFixed(2)}`).join('\n');
  const adminText = [
    'Porosi e re nga faqja',
    '',
    `Referenca: #${ref}`,
    `Klienti: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Telefon: ${order.customer.phone}`,
    order.customer.company ? `Kompania: ${order.customer.company}` : '',
    order.customer.notes ? `Shënime: ${order.customer.notes}` : '',
    '',
    lines,
    '',
    `Totali: €${order.total.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const adminResult = await sendEmail(env, {
    subject: `Porosi e Reja #${ref} — Eltex Group`,
    text: adminText,
    replyTo: order.customer.email,
  });

  if (!adminResult.sent) return adminResult;

  await sendEmail(env, {
    to: order.customer.email,
    subject: `Faleminderit! Porosia juaj #${ref} u pranua — Eltex Group`,
    text: `Përshëndetje ${order.customer.name},\n\nFaleminderit për porosinë tuaj te Eltex Group.\nReferenca: #${ref}\nTotali: €${order.total.toFixed(2)}\n\nEkipi ynë do t'ju kontaktojë së shpejti.\n\nMe respekt,\nEltex Group`,
  });

  return { sent: true };
}

export async function sendContactEmail(env, contact) {
  const text = [
    'Mesazh i ri nga forma e kontaktit',
    '',
    `Emri: ${contact.name}`,
    `Email: ${contact.email}`,
    `Telefoni: ${contact.phone || '—'}`,
    '',
    contact.message || '(pa mesazh)',
  ].join('\n');

  return sendEmail(env, {
    subject: `Kontakt i ri — ${contact.name}`,
    text,
    replyTo: contact.email,
  });
}

import nodemailer from "nodemailer";

type CustomerConfirmationInput = {
  to: string;
  customerName: string;
  companyName: string;
  senderName: string;
  logoUrl: string | null;
  primaryColor: string;
  contactInfo: string | null;
  timezone: string;
  startAt: Date;
  partySize: number;
  resourceName: string;
  cancelUrl: string;
};

type OwnerNotificationInput = {
  ownerEmail: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerComments: string | null;
  companyName: string;
  senderName: string;
  logoUrl: string | null;
  primaryColor: string;
  contactInfo: string | null;
  timezone: string;
  startAt: Date;
  partySize: number;
  resourceName: string;
  cancelUrl: string;
};

type CustomerCancellationInput = {
  to: string;
  customerName: string;
  companyName: string;
  senderName: string;
  logoUrl: string | null;
  primaryColor: string;
  contactInfo: string | null;
  timezone: string;
  startAt: Date;
  partySize: number;
};

type OwnerCancellationInput = {
  ownerEmail: string;
  customerName: string;
  customerEmail: string | null;
  companyName: string;
  senderName: string;
  logoUrl: string | null;
  primaryColor: string;
  contactInfo: string | null;
  timezone: string;
  startAt: Date;
  partySize: number;
  resourceName: string;
};

// --- Helpers ---

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatWhen(startAt: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startAt);
}

function getTransporter(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER ?? "reservas@trocha.shop";
  const pass = process.env.SMTP_PASS ?? "";

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function fromAddress(senderName: string): string {
  const email = process.env.EMAIL_FROM ?? "reservas@trocha.shop";
  return senderName ? `${senderName} <${email}>` : email;
}

// --- HTML layout ---

type Branding = {
  logoUrl: string | null;
  primaryColor: string;
  companyName: string;
  contactInfo: string | null;
};

function htmlLayout(body: string, b: Branding): string {
  const c = b.primaryColor;
  const logo = b.logoUrl
    ? `<img src="${esc(b.logoUrl)}" alt="${esc(b.companyName)}" style="max-height:56px;width:auto;display:inline-block">`
    : `<div style="font-size:26px;font-weight:700;color:${esc(c)};letter-spacing:-.5px">${esc(b.companyName)}</div>`;

  const contact = b.contactInfo
    ? `<div style="margin-top:12px;font-size:12px;color:#6b7280;line-height:1.6">${esc(b.contactInfo).replace(/\n/g, "<br>")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media only screen and (max-width:600px){
    .inner{padding:24px 20px!important}
    .hdr{padding:28px 20px 0!important}
    .ftr{padding:0 20px 28px!important}
    .btn{display:block!important;text-align:center!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" class="inner" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

  <tr><td class="hdr" style="padding:32px 32px 0;text-align:center">
    ${logo}
    <div style="height:3px;width:48px;margin:12px auto 0;background:${esc(c)};border-radius:2px"></div>
  </td></tr>

  ${body}

  <tr><td class="ftr" style="padding:0 32px 32px;text-align:center">
    <div style="border-top:1px solid #e5e7eb;margin:0 0 20px"></div>
    <div style="font-size:12px;color:#9ca3af">${esc(b.companyName)}</div>
    ${contact}
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:#6b7280;width:100px;vertical-align:top">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500">${esc(value)}</td>
  </tr>`;
}

// --- Customer Confirmation ---

export async function sendCustomerConfirmation(input: CustomerConfirmationInput): Promise<void> {
  const when = formatWhen(input.startAt, input.timezone);
  const subject = `Reserva confirmada — ${input.companyName}`;
  const b: Branding = { logoUrl: input.logoUrl, primaryColor: input.primaryColor, companyName: input.companyName, contactInfo: input.contactInfo };

  const text =
    `Hola ${input.customerName}:\n\n` +
    `Tu reserva en ${input.companyName} está confirmada.\n` +
    `Cuándo: ${when} (${input.timezone})\n` +
    `Personas: ${input.partySize}\n\n` +
    `¿Necesitas cancelar? ${input.cancelUrl}\n`;

  const body = `
  <tr><td style="padding:24px 32px 8px">
    <div style="text-align:center">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#d1fae5;line-height:56px;font-size:28px;margin-bottom:8px">&#10003;</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827">Reserva confirmada</h1>
      <p style="margin:6px 0 0;font-size:15px;color:#6b7280">${esc(input.companyName)}</p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px">
    <p style="font-size:15px;color:#374151;margin:0 0 16px">Hola <strong>${esc(input.customerName)}</strong>,</p>
    <p style="font-size:15px;color:#374151;margin:0 0 20px">Tu reserva ha sido confirmada. Aquí tienes los detalles:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
      ${infoRow("Fecha", when)}
      ${infoRow("Zona horaria", input.timezone)}
      ${infoRow("Personas", `${input.partySize}`)}
      ${infoRow("Mesa / Área", input.resourceName)}
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px 8px;text-align:center">
    <p style="font-size:14px;color:#6b7280;margin:0 0 12px">¿Necesitas cancelar tu reserva?</p>
    <a href="${esc(input.cancelUrl)}" class="btn" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;text-decoration:none">Cancelar reserva</a>
  </td></tr>
  `;

  await send({ to: input.to, subject, text, html: htmlLayout(body, b), label: "customer confirmation", senderName: input.senderName });
}

// --- Owner Notification ---

export async function sendOwnerNotification(input: OwnerNotificationInput): Promise<void> {
  const when = formatWhen(input.startAt, input.timezone);
  const subject = `Nueva reserva — ${input.companyName}`;
  const b: Branding = { logoUrl: input.logoUrl, primaryColor: input.primaryColor, companyName: input.companyName, contactInfo: input.contactInfo };

  const phoneLine = input.customerPhone ? `Teléfono: ${input.customerPhone}\n` : "";
  const commentsLine = input.customerComments ? `Comentarios: ${input.customerComments}\n` : "";
  const text =
    `Se ha realizado una nueva reserva en ${input.companyName}.\n\n` +
    `Cliente: ${input.customerName}\n` +
    `Email: ${input.customerEmail ?? "—"}\n` +
    `${phoneLine}` +
    `${commentsLine}` +
    `Personas: ${input.partySize}\n` +
    `Recurso: ${input.resourceName}\n` +
    `Cuándo: ${when} (${input.timezone})\n\n` +
    `Cancelar: ${input.cancelUrl}\n`;

  const body = `
  <tr><td style="padding:24px 32px 8px">
    <div style="text-align:center">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#dbeafe;line-height:56px;font-size:28px;margin-bottom:8px">&#128276;</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827">Nueva reserva</h1>
      <p style="margin:6px 0 0;font-size:15px;color:#6b7280">${esc(input.companyName)}</p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px">
    <p style="font-size:15px;color:#374151;margin:0 0 16px">Se ha realizado una nueva reserva:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
      ${infoRow("Cliente", input.customerName)}
      ${infoRow("Email", input.customerEmail ?? "—")}
      ${infoRow("Teléfono", input.customerPhone ?? "—")}
      ${input.customerComments ? infoRow("Comentarios", input.customerComments) : ""}
      ${infoRow("Personas", `${input.partySize}`)}
      ${infoRow("Mesa / Área", input.resourceName)}
      ${infoRow("Fecha", when)}
      ${infoRow("Zona horaria", input.timezone)}
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px 8px;text-align:center">
    <a href="${esc(input.cancelUrl)}" class="btn" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;text-decoration:none">Cancelar reserva</a>
  </td></tr>
  `;

  await send({ to: input.ownerEmail, subject, text, html: htmlLayout(body, b), label: "owner notification", senderName: input.senderName });
}

// --- Customer Cancellation ---

export async function sendCustomerCancellation(input: CustomerCancellationInput): Promise<void> {
  const when = formatWhen(input.startAt, input.timezone);
  const subject = `Reserva cancelada — ${input.companyName}`;
  const b: Branding = { logoUrl: input.logoUrl, primaryColor: input.primaryColor, companyName: input.companyName, contactInfo: input.contactInfo };

  const text =
    `Hola ${input.customerName}:\n\n` +
    `Tu reserva en ${input.companyName} ha sido cancelada.\n` +
    `Cuándo: ${when} (${input.timezone})\n` +
    `Personas: ${input.partySize}\n\n` +
    `Si no solicitaste esta cancelación, por favor contacta al establecimiento.\n`;

  const body = `
  <tr><td style="padding:24px 32px 8px">
    <div style="text-align:center">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#fee2e2;line-height:56px;font-size:28px;margin-bottom:8px">&#10007;</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827">Reserva cancelada</h1>
      <p style="margin:6px 0 0;font-size:15px;color:#6b7280">${esc(input.companyName)}</p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px">
    <p style="font-size:15px;color:#374151;margin:0 0 16px">Hola <strong>${esc(input.customerName)}</strong>,</p>
    <p style="font-size:15px;color:#374151;margin:0 0 20px">Tu reserva ha sido cancelada según lo solicitado.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
      ${infoRow("Fecha", when)}
      ${infoRow("Zona horaria", input.timezone)}
      ${infoRow("Personas", `${input.partySize}`)}
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px 8px">
    <p style="font-size:14px;color:#6b7280;margin:0;text-align:center">Si no solicitaste esta cancelación, por favor contacta directamente al establecimiento.</p>
  </td></tr>
  `;

  await send({ to: input.to, subject, text, html: htmlLayout(body, b), label: "customer cancellation", senderName: input.senderName });
}

// --- Owner Cancellation ---

export async function sendOwnerCancellation(input: OwnerCancellationInput): Promise<void> {
  const when = formatWhen(input.startAt, input.timezone);
  const subject = `Reserva cancelada — ${input.companyName}`;
  const b: Branding = { logoUrl: input.logoUrl, primaryColor: input.primaryColor, companyName: input.companyName, contactInfo: input.contactInfo };

  const text =
    `Una reserva ha sido cancelada en ${input.companyName}.\n\n` +
    `Cliente: ${input.customerName}\n` +
    `Email: ${input.customerEmail ?? "—"}\n` +
    `Personas: ${input.partySize}\n` +
    `Recurso: ${input.resourceName}\n` +
    `Cuándo: ${when} (${input.timezone})\n`;

  const body = `
  <tr><td style="padding:24px 32px 8px">
    <div style="text-align:center">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#fef3c7;line-height:56px;font-size:28px;margin-bottom:8px">&#9888;</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827">Reserva cancelada</h1>
      <p style="margin:6px 0 0;font-size:15px;color:#6b7280">${esc(input.companyName)}</p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px">
    <p style="font-size:15px;color:#374151;margin:0 0 16px">Una reserva ha sido cancelada:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
      ${infoRow("Cliente", input.customerName)}
      ${infoRow("Email", input.customerEmail ?? "—")}
      ${infoRow("Personas", `${input.partySize}`)}
      ${infoRow("Mesa / Área", input.resourceName)}
      ${infoRow("Fecha", when)}
      ${infoRow("Zona horaria", input.timezone)}
    </table>
  </td></tr>
  `;

  await send({ to: input.ownerEmail, subject, text, html: htmlLayout(body, b), label: "owner cancellation", senderName: input.senderName });
}

// --- Send helper ---

async function send({
  to,
  subject,
  text,
  html,
  label,
  senderName,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  label: string;
  senderName: string;
}): Promise<void> {
  const pass = process.env.SMTP_PASS;
  if (!pass) {
    console.log(`[email] no SMTP_PASS — would ${label} to ${to}:\n${text}`);
    return;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({ from: fromAddress(senderName), to, subject, text, html });
  } catch (err) {
    console.error(`[email] ${label} failed:`, err);
  }
}

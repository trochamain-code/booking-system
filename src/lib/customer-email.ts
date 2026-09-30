import { bookingLanguage, translator, intlLocale, money, localizedCompanyText } from "./booking-locale";

export type CustomerEmailDetails = {
  language?: string;
  customerName: string;
  companyName: string;
  timezone: string;
  startAt: Date;
  partySize: number;
  resourceName?: string;
};
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function customerEmailContent(input: CustomerEmailDetails, options:
  | { kind: "confirmation"; policyLines: string[]; cancelUrl: string; paid?: boolean }
  | { kind: "cancellation"; refundCents?: number | null }) {
  const lang = bookingLanguage(input.language);
  const t = translator(lang);
  const title = t(options.kind === "confirmation" ? "confirmationTitle" : "cancelled");
  const greeting = t("hello", { name: input.customerName });
  const intro = t(options.kind === "confirmation" ? "confirmationIntro" : "cancellationIntro", { company: input.companyName });
  const when = new Intl.DateTimeFormat(intlLocale[lang], {
    timeZone: input.timezone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(input.startAt);
  const rows = [[t("date"), when], [t("timezone"), input.timezone], [t("people"), String(input.partySize)]];
  if (options.kind === "confirmation" && input.resourceName) rows.push([t("resource"), localizedCompanyText(input.resourceName, lang, input.resourceName)]);
  const lines = [greeting, "", intro, ...rows.map(([label, value]) => `${label}: ${value}`), ""];
  const esc = escapeHtml;
  let html = `<tr><td style="padding:24px 32px"><h1 style="font-size:22px;text-align:center">${esc(title)}</h1><p>${esc(greeting)}</p><p>${esc(intro)}</p><table role="presentation" width="100%" style="background:#f9fafb;border-radius:8px;padding:16px">${rows.map(([label, value]) => `<tr><td style="padding:6px;color:#6b7280">${esc(label)}</td><td style="padding:6px">${esc(value)}</td></tr>`).join("")}</table>`;
  if (options.kind === "confirmation") {
    const hint = t(options.paid ? "refundHint" : "cancelHint");
    const action = t(options.paid ? "cancelViewRefund" : "cancel");
    lines.push(t("policy"), ...options.policyLines, "", hint, `${action}: ${options.cancelUrl}`);
    html += `<h2 style="font-size:18px">${esc(t("policy"))}</h2>${options.policyLines.map(line => `<p>${esc(line)}</p>`).join("")}<p>${esc(hint)}</p><a href="${esc(options.cancelUrl)}" class="btn" style="display:inline-block;padding:12px 28px;color:#dc2626;background:#fef2f2;border-radius:8px;text-decoration:none">${esc(action)}</a>`;
  } else {
    if (options.refundCents && options.refundCents > 0) {
      const refund = t("refundEmail", { amount: money(options.refundCents, lang) });
      lines.push(refund);
      html += `<p>${esc(refund)}</p>`;
    }
    lines.push(t("cancellationUnexpected"));
    html += `<p>${esc(t("cancellationUnexpected"))}</p>`;
  }
  return { lang, subject: `${title} — ${input.companyName}`, text: lines.join("\n"), body: html + "</td></tr>" };
}

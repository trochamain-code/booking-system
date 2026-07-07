type ConfirmationInput = {
  to: string;
  customerName: string;
  companyName: string;
  timezone: string;
  startAt: Date;
  partySize: number;
  cancelUrl: string;
};

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

// Sends via Resend's HTTP API. No API key (e.g. local dev) => log instead of failing.
// A failed send never blocks the booking — it's logged, not thrown.
export async function sendBookingConfirmation(input: ConfirmationInput): Promise<void> {
  const when = formatWhen(input.startAt, input.timezone);
  const subject = `Reserva confirmada — ${input.companyName}`;
  const text =
    `Hola ${input.customerName}:\n\n` +
    `Tu reserva en ${input.companyName} está confirmada.\n` +
    `Cuándo: ${when} (${input.timezone})\n` +
    `Personas: ${input.partySize}\n\n` +
    `¿Necesitas cancelar? ${input.cancelUrl}\n`;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] no RESEND_API_KEY — would send to ${input.to}:\n${text}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Bookings <onboarding@resend.dev>",
        to: input.to,
        subject,
        text,
      }),
    });
    if (!res.ok) console.error(`[email] Resend responded ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

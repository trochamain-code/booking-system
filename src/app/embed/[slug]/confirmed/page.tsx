import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/booking-data";
import { confirmPayment } from "@/lib/stripe-actions";
import { contrastText } from "@/lib/color";

export default async function ConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const { token, session_id: sessionId } = await searchParams;

  if (!token) notFound();

  let booking = token ? await getBookingByToken(token) : undefined;

  let paymentConfirmed = false;
  if (!booking && sessionId && token) {
    const result = await confirmPayment(sessionId, token, slug);
    if (result.ok) {
      booking = { ...result.booking, slug };
      paymentConfirmed = true;
    } else {
      // The customer may have just PAID — never show a bare 404 here.
      const messages: Record<string, string> = {
        slot_taken: result.refunded
          ? "El horario elegido dejó de estar disponible mientras completabas el pago. Te hemos devuelto el importe automáticamente — no se te cobrará nada."
          : "El horario elegido dejó de estar disponible mientras completabas el pago. No hemos podido procesar la devolución automáticamente: contacta con el establecimiento para que te devuelvan el importe.",
        not_paid: "El pago no se ha completado, así que la reserva no se ha creado. Puedes intentarlo de nuevo.",
        rate: "Demasiadas solicitudes. Espera un momento y recarga esta página.",
      };
      const message =
        messages[result.error] ??
        "No hemos podido verificar el pago en este momento. Recarga esta página en unos segundos; si el problema persiste, contacta con el establecimiento.";
      return (
        <main className="mx-auto max-w-lg p-4 sm:p-6">
          <div className="card overflow-hidden">
            <div style={{ height: "4px", backgroundColor: "var(--color-subtle)" }} />
            <div className="p-8 text-center">
              <h1 className="text-2xl font-semibold text-ink">No se pudo completar la reserva</h1>
              <p className="mt-4 text-sm text-muted">{message}</p>
              <Link href={`/embed/${slug}`} className="mt-6 inline-block text-sm text-muted underline underline-offset-4 hover:text-ink">
                Volver a las reservas
              </Link>
            </div>
          </div>
        </main>
      );
    }
  }

  if (!booking) notFound();

  const when = new Intl.DateTimeFormat("es-ES", {
    timeZone: booking.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(booking.startAt);

  const cancelled = booking.status === "cancelled";

  return (
    <main
      className="mx-auto max-w-lg p-4 sm:p-6"
      style={{ ["--brand" as string]: booking.primaryColor, ["--brand-text" as string]: contrastText(booking.primaryColor) }}
    >
      <div className="card overflow-hidden">
        <div style={{ height: "4px", backgroundColor: cancelled ? "var(--color-subtle)" : "var(--brand)" }} />

        <div className="p-8 text-center">
          {booking.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={booking.logoUrl} alt={booking.companyName} className="mx-auto mb-4 h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: cancelled ? "var(--color-subtle)" : "var(--brand)" }}
              aria-hidden
            >
              {booking.companyName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: cancelled ? "var(--color-subtle)" : "var(--brand)" }}
          >
            {cancelled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-ink">
            {cancelled ? "Reserva cancelada" : paymentConfirmed ? "¡Pago confirmado!" : "¡Reserva confirmada!"}
          </h1>
          <p className="mt-1 text-sm text-muted">{booking.welcomeText || booking.companyName}</p>
          <p className="mt-2 text-ink first-letter:uppercase">{when}</p>
          <p className="text-sm text-muted">
            {booking.companyName} · {booking.partySize} personas
          </p>
          {!cancelled && (
            <p className="mt-4 text-sm text-muted">Te hemos enviado un correo con los detalles.</p>
          )}

          {!cancelled && token && (
            <Link href={`/cancel/${token}`} className="mt-6 inline-block text-sm text-muted underline underline-offset-4 hover:text-ink">
              Cancelar esta reserva
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

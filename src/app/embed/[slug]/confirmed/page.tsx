import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/booking-data";
import { contrastText } from "@/lib/color";

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const booking = token ? await getBookingByToken(token) : undefined;
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
            {cancelled ? "Reserva cancelada" : "¡Reserva confirmada!"}
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

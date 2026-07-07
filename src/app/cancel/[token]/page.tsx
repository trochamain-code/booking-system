import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/booking-data";
import { cancelBooking } from "@/lib/booking-actions";
import { contrastText } from "@/lib/color";

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const when = new Intl.DateTimeFormat("es-ES", {
    timeZone: booking.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(booking.startAt);

  const cancelled = done || booking.status === "cancelled";

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6" style={{ ["--brand" as string]: booking.primaryColor, ["--brand-text" as string]: contrastText(booking.primaryColor) }}>
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

          <h1 className="text-2xl font-semibold text-ink">
            {cancelled ? "Reserva cancelada" : "¿Cancelar tu reserva?"}
          </h1>
          <p className="mt-1 text-sm text-muted">{booking.welcomeText || booking.companyName}</p>
          <p className="mt-2 text-ink first-letter:uppercase">{when}</p>
          <p className="text-sm text-muted">
            {booking.companyName} · {booking.partySize} personas
          </p>

          {cancelled ? (
            <p className="mt-6 text-sm text-muted">Esta reserva ha sido cancelada.</p>
          ) : (
            <form action={cancelBooking} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button className="btn btn-danger">Sí, cancelar reserva</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

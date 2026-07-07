import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/booking-data";
import { cancelBooking } from "@/lib/booking-actions";

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
    <main className="mx-auto max-w-lg p-4 sm:p-6">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink">
          {cancelled ? "Reserva cancelada" : "¿Cancelar tu reserva?"}
        </h1>
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
    </main>
  );
}

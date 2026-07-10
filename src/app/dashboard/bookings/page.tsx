import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, resources } from "@/lib/schema";
import { dayRangeUtc } from "@/lib/availability";
import { staffCancelBooking, staffCreateBooking } from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";
import { isDateStr } from "@/lib/validation";
import { getAvailability, getAvailableDates } from "@/lib/booking-data";
import { DatePickerField } from "@/app/date-picker-field";
import { ChevronLeftIcon, ChevronRightIcon } from "@/app/icons";
import Link from "next/link";

/** Shift a YYYY-MM-DD date string by whole days. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; created?: string; error?: string }>;
}) {
  const { companyId, company } = await requireCompany();

  const sp = await searchParams;

  const availableDates = await getAvailableDates(company, 2);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = sp.date && isDateStr(sp.date) ? sp.date : today;

  const { start, end } = dayRangeUtc(date, company.timezone);
  const [rows, daySlots, maxCapacityRow] = await Promise.all([
    db
      .select({
        id: bookings.id,
        startAt: bookings.startAt,
        partySize: bookings.partySize,
        customerName: bookings.customerName,
        email: bookings.email,
        phone: bookings.phone,
        comments: bookings.comments,
        status: bookings.status,
        source: bookings.source,
        amountCents: bookings.amountCents,
        resourceName: resources.name,
      })
      .from(bookings)
      .innerJoin(resources, eq(bookings.resourceId, resources.id))
      .where(and(eq(bookings.companyId, companyId), gte(bookings.startAt, start), lt(bookings.startAt, end)))
      .orderBy(asc(bookings.startAt)),
    // Slots with at least one free plaza this day (past turns included so a
    // phone booking can still be logged after the turn started).
    getAvailability(company, date, 1, { includePast: true }),
    db
      .select({ max: resources.capacity })
      .from(resources)
      .where(and(eq(resources.companyId, companyId), eq(resources.active, true)))
      .orderBy(desc(resources.capacity))
      .limit(1),
  ]);
  const maxPartySize = Math.max(1, maxCapacityRow[0]?.max ?? 1);

  const heading = new Intl.DateTimeFormat("es-ES", {
    timeZone: company.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat("es-ES", { timeZone: company.timezone, hour: "2-digit", minute: "2-digit" }).format(d);

  const confirmed = rows.filter((r) => r.status === "confirmed");
  const confirmedCount = confirmed.length;
  const confirmedSeats = confirmed.reduce((sum, r) => sum + r.partySize, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Reservas</h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {heading} · {confirmedCount} confirmada{confirmedCount === 1 ? "" : "s"} · {confirmedSeats} persona{confirmedSeats === 1 ? "" : "s"}
          </p>
        </div>
        <div data-tour="bookings-day" className="flex flex-wrap items-end gap-2">
          <Link
            href={`/dashboard/bookings?date=${shiftDate(date, -1)}`}
            className="btn btn-ghost"
            aria-label="Día anterior"
          >
            <ChevronLeftIcon />
          </Link>
          <Link
            href={`/dashboard/bookings?date=${today}`}
            className="btn btn-ghost"
            aria-current={date === today ? "date" : undefined}
          >
            Hoy
          </Link>
          <Link
            href={`/dashboard/bookings?date=${shiftDate(date, 1)}`}
            className="btn btn-ghost"
            aria-label="Día siguiente"
          >
            <ChevronRightIcon />
          </Link>
          <form method="get" className="flex items-end gap-2">
            <DatePickerField name="date" defaultValue={date} label="Fecha" availableDates={[...availableDates]} />
            <button className="btn btn-ghost">Ver</button>
          </form>
        </div>
      </header>

      {sp.created && (
        <p role="status" className="rounded-xl bg-success-bg px-3 py-2 text-sm text-success">
          Reserva manual guardada — las plazas del día quedan actualizadas.
        </p>
      )}
      {sp.error === "invalid" && (
        <p role="alert" className="rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
          Revisa los datos: hacen falta al menos fecha, hora, personas y nombre (y un email válido si lo indicas).
        </p>
      )}
      {sp.error === "full" && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
          No quedan plazas suficientes en ese horario para ese número de personas.
        </p>
      )}

      <details className="card" open={Boolean(sp.error)} data-tour="manual-booking">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink">
          + Añadir reserva manual
          <span className="ml-2 font-normal text-muted">teléfono, WhatsApp o en persona — sin coste</span>
        </summary>
        {daySlots.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-sm text-muted">
            No hay horarios con plazas libres este día (cerrado o completo). Navega a otra fecha para añadir la reserva.
          </p>
        ) : (
          <form action={staffCreateBooking} className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
            <input type="hidden" name="date" value={date} />
            <div>
              <label className="label" htmlFor="manual-time">Hora</label>
              <select id="manual-time" name="time" required className="select w-full">
                {daySlots.map((s) => (
                  <option key={s.time} value={s.time}>
                    {s.time} · quedan {s.remaining} de {s.capacity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="manual-party">Personas</label>
              <input
                id="manual-party"
                name="partySize"
                type="number"
                min={1}
                max={maxPartySize}
                defaultValue={2}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="label" htmlFor="manual-name">Nombre</label>
              <input id="manual-name" name="customerName" required autoComplete="off" className="input w-full" />
            </div>
            <div>
              <label className="label" htmlFor="manual-phone">Teléfono</label>
              <input id="manual-phone" name="phone" type="tel" autoComplete="off" className="input w-full" />
            </div>
            <div>
              <label className="label" htmlFor="manual-email">Email (opcional)</label>
              <input id="manual-email" name="email" type="email" autoComplete="off" className="input w-full" />
            </div>
            <div>
              <label className="label" htmlFor="manual-comments">Comentarios</label>
              <input id="manual-comments" name="comments" placeholder="Alergias, trona, terraza…" className="input w-full" />
            </div>
            <div className="flex items-end justify-between gap-3 sm:col-span-3">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" />
                Enviar confirmación por email (si hay email)
              </label>
              <button className="btn btn-primary">Guardar reserva</button>
            </div>
          </form>
        )}
      </details>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-ink">Sin reservas</p>
          <p className="mt-1 text-sm text-muted">Nada programado para {heading}.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-border">
          {rows.map((b) => {
            const cancelled = b.status === "cancelled";
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-20 shrink-0 font-medium tabular-nums text-ink">{fmtTime(b.startAt)}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${cancelled ? "text-subtle line-through" : "text-ink"}`}>
                    {b.customerName}
                    <span className="ml-2 font-normal text-muted">
                      {b.partySize} pers. · {b.resourceName}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[b.phone, b.email].filter(Boolean).join(" · ")}
                  </p>
                  {b.comments && <p className="mt-0.5 text-xs italic text-muted">“{b.comments}”</p>}
                </div>
                {b.source === "manual" && (
                  <span className="badge bg-warn-bg text-warn">Manual</span>
                )}
                {b.amountCents !== null && (
                  <span className="badge bg-success-bg text-success">
                    Pagada · {(b.amountCents / 100).toFixed(2)} €
                  </span>
                )}
                {cancelled ? (
                  <span className="badge bg-danger-bg text-danger">Cancelada</span>
                ) : (
                  <form action={staffCancelBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="row-action">Cancelar</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

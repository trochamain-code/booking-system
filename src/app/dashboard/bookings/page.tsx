import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, resources } from "@/lib/schema";
import { dayRangeUtc } from "@/lib/availability";
import { staffCancelBooking } from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";
import { isDateStr } from "@/lib/validation";
import { DatePickerField } from "@/app/date-picker-field";
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
  searchParams: Promise<{ date?: string }>;
}) {
  const { companyId, company } = await requireCompany();

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const sp = await searchParams;
  const date = sp.date && isDateStr(sp.date) ? sp.date : today;

  const { start, end } = dayRangeUtc(date, company.timezone);
  const rows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      partySize: bookings.partySize,
      customerName: bookings.customerName,
      email: bookings.email,
      phone: bookings.phone,
      status: bookings.status,
      amountCents: bookings.amountCents,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(and(eq(bookings.companyId, companyId), gte(bookings.startAt, start), lt(bookings.startAt, end)))
    .orderBy(asc(bookings.startAt));

  const heading = new Intl.DateTimeFormat("es-ES", {
    timeZone: company.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat("es-ES", { timeZone: company.timezone, hour: "2-digit", minute: "2-digit" }).format(d);

  const confirmedCount = rows.filter((r) => r.status === "confirmed").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Reservas</h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {heading} · {confirmedCount} confirmada{confirmedCount === 1 ? "" : "s"}
          </p>
        </div>
        <div data-tour="bookings-day" className="flex flex-wrap items-end gap-2">
          <Link
            href={`/dashboard/bookings?date=${shiftDate(date, -1)}`}
            className="btn btn-ghost"
            aria-label="Día anterior"
          >
            ←
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
            →
          </Link>
          <form method="get" className="flex items-end gap-2">
            <DatePickerField name="date" defaultValue={date} label="Fecha" />
            <button className="btn btn-ghost">Ver</button>
          </form>
        </div>
      </header>

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
                    {b.email}
                    {b.phone ? ` · ${b.phone}` : ""}
                  </p>
                </div>
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
                    <button className="text-xs text-subtle transition hover:text-danger">Cancelar</button>
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

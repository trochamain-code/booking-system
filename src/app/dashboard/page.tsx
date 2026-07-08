import { and, count, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { resources, bookings, openingHours } from "@/lib/schema";
import { dayRangeUtc } from "@/lib/availability";
import { requireCompany } from "@/lib/company";

export default async function OverviewPage() {
  const { companyId, company } = await requireCompany();

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { start, end } = dayRangeUtc(today, company.timezone);
  const weekEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [[todayCount], [weekCount], [resourceCount], [hoursCount]] = await Promise.all([
    db
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.companyId, companyId), eq(bookings.status, "confirmed"), gte(bookings.startAt, start), lt(bookings.startAt, end))),
    db
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.companyId, companyId), eq(bookings.status, "confirmed"), gte(bookings.startAt, start), lt(bookings.startAt, weekEnd))),
    db
      .select({ n: count() })
      .from(resources)
      .where(and(eq(resources.companyId, companyId), eq(resources.active, true))),
    db.select({ n: count() }).from(openingHours).where(eq(openingHours.companyId, companyId)),
  ]);

  const stats = [
    { label: "Reservas hoy", value: todayCount.n, href: `/dashboard/bookings?date=${today}` },
    { label: "Próximos 7 días", value: weekCount.n, href: "/dashboard/bookings" },
    { label: "Recursos activos", value: resourceCount.n, href: "/dashboard/resources" },
  ];

  const setupSteps = [
    {
      done: resourceCount.n > 0,
      title: "Crea tu primer recurso",
      detail: "Lo que se reserva: una mesa, una pista, una sala…",
      href: "/dashboard/resources",
      cta: "Añadir recurso",
    },
    {
      done: hoursCount.n > 0,
      title: "Define tu horario de apertura",
      detail: "Sin horario, tus clientes no verán huecos disponibles.",
      href: "/dashboard/hours",
      cta: "Añadir horario",
    },
  ];
  const doneCount = setupSteps.filter((s) => s.done).length;
  const setupComplete = doneCount === setupSteps.length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink">Resumen</h1>

      {!setupComplete && (
        <section data-tour="setup" className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Primeros pasos</h2>
              <p className="mt-0.5 text-sm text-muted">
                Completa estos pasos para empezar a recibir reservas. Llevas {doneCount} de {setupSteps.length}.
              </p>
            </div>
            <div className="flex h-2 w-32 overflow-hidden rounded-full bg-border" role="presentation">
              <div
                className="rounded-full bg-primary transition-all"
                style={{ width: `${(doneCount / setupSteps.length) * 100}%` }}
              />
            </div>
          </div>
          <ol className="divide-y divide-border">
            {setupSteps.map((s, i) => (
              <li key={s.title} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-success-bg text-success" : "border border-border-strong text-muted"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${s.done ? "text-muted line-through" : "text-ink"}`}>{s.title}</p>
                  {!s.done && <p className="text-xs text-muted">{s.detail}</p>}
                </div>
                {!s.done && (
                  <Link href={s.href} className="btn btn-ghost btn-sm">
                    {s.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div data-tour="stats" className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:border-border-strong">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{s.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

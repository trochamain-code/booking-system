import { and, count, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { resources, bookings } from "@/lib/schema";
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

  const [[todayCount], [weekCount], [resourceCount]] = await Promise.all([
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
  ]);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const widgetUrl = `${appUrl}/embed/${company.slug}`;

  const stats = [
    { label: "Reservas hoy", value: todayCount.n, href: `/dashboard/bookings?date=${today}` },
    { label: "Próximos 7 días", value: weekCount.n, href: "/dashboard/bookings" },
    { label: "Recursos activos", value: resourceCount.n, href: "/dashboard/resources" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink">Resumen</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:border-border-strong">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{s.value}</p>
          </Link>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-ink">Tu widget de reservas</h2>
        <p className="mt-1 text-sm text-muted">
          {resourceCount.n === 0
            ? "Añade un recurso y tu horario, luego comparte este enlace para empezar a recibir reservas."
            : "Comparte este enlace o incrústalo en tu web para empezar a recibir reservas."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-xs text-muted">
            {widgetUrl}
          </code>
          <a href={widgetUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
            Abrir widget
          </a>
          <Link href="/dashboard/settings" className="btn btn-primary">
            Código para incrustar
          </Link>
        </div>
      </section>
    </div>
  );
}

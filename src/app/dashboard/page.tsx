import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { resources, bookings, openingHours } from "@/lib/schema";
import { dayRangeUtc } from "@/lib/availability";
import { requireCompany } from "@/lib/company";
import { CheckIcon } from "@/app/icons";
import { Chart } from "@/app/chart";

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fmtDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function SparklineCard({ label, value, data, color }: { label: string; value: string; data: number[]; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-ink">{value}</p>
      </div>
      <Chart
        options={{
          grid: { left: 0, right: 0, top: 0, bottom: 0 },
          xAxis: { show: false },
          yAxis: { show: false },
          series: [{
            type: "line",
            data,
            smooth: true,
            lineStyle: { color, width: 1.5 },
            areaStyle: { color: hexToRgba(color, 0.12) },
            itemStyle: { color },
            symbol: "none",
            showSymbol: false,
          }],
        }}
        className="h-8"
      />
    </div>
  );
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function OverviewPage() {
  const { companyId, company } = await requireCompany();

  const now = new Date();
  const today = fmtDate(now, company.timezone);
  const monthStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const { start: dayStart, end: dayEnd } = dayRangeUtc(today, company.timezone);

  const [
    [resourceCount],
    [hoursCount],
    historyRows,
    revenueRow,
    statsRow,
    monthBookings,
    resourceRows,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(resources)
      .where(and(eq(resources.companyId, companyId), eq(resources.active, true))),
    db.select({ n: count() }).from(openingHours).where(eq(openingHours.companyId, companyId)),
    db
      .select({
        id: bookings.id,
        startAt: bookings.startAt,
        customerName: bookings.customerName,
        partySize: bookings.partySize,
        status: bookings.status,
        resourceName: resources.name,
      })
      .from(bookings)
      .innerJoin(resources, eq(bookings.resourceId, resources.id))
      .where(and(eq(bookings.companyId, companyId), lt(bookings.startAt, now)))
      .orderBy(desc(bookings.startAt))
      .limit(10),
    db
      .select({ total: sql<number>`COALESCE(SUM(amount_cents), 0)` })
      .from(bookings)
      .where(and(eq(bookings.companyId, companyId), eq(bookings.status, "confirmed"), gte(bookings.startAt, monthStart), lt(bookings.startAt, dayEnd))),
    db
      .select({
        total: count(),
        cancelled: sql<number>`SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)`,
        totalParty: sql<number>`COALESCE(SUM(party_size), 0)`,
      })
      .from(bookings)
      .where(and(eq(bookings.companyId, companyId), gte(bookings.startAt, monthStart))),
    db
      .select({
        startAt: bookings.startAt,
        resourceName: resources.name,
        partySize: bookings.partySize,
        status: bookings.status,
        amountCents: bookings.amountCents,
      })
      .from(bookings)
      .innerJoin(resources, eq(bookings.resourceId, resources.id))
      .where(and(eq(bookings.companyId, companyId), gte(bookings.startAt, monthStart)))
      .orderBy(asc(bookings.startAt)),
    db
      .select({ id: resources.id, name: resources.name })
      .from(resources)
      .where(and(eq(resources.companyId, companyId), eq(resources.active, true))),
  ]);

  const totalBookings = statsRow[0]?.total ?? 0;
  const cancelledCount = statsRow[0]?.cancelled ?? 0;
  const totalParty = statsRow[0]?.totalParty ?? 0;
  const totalRevenue = revenueRow[0]?.total ?? 0;
  const cancellationRate = totalBookings > 0 ? Math.round((cancelledCount / totalBookings) * 100) : 0;
  const avgPartySize = totalBookings > 0 ? (totalParty / totalBookings).toFixed(1) : "0";

  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) dates.push(shiftDate(today, -i));

  const dayMap = new Map<string, { confirmed: number; cancelled: number; revenue: number; partyTotal: number }>();
  for (const d of dates) dayMap.set(d, { confirmed: 0, cancelled: 0, revenue: 0, partyTotal: 0 });
  for (const b of monthBookings) {
    const d = fmtDate(b.startAt, company.timezone);
    const entry = dayMap.get(d);
    if (entry) {
      if (b.status === "confirmed") {
        entry.confirmed += 1;
        entry.partyTotal += b.partySize ?? 0;
        if (b.amountCents) entry.revenue += b.amountCents;
      } else {
        entry.cancelled += 1;
      }
    }
  }

  const bookingVolumeData = dates.map((d) => dayMap.get(d)!.confirmed);
  const revenueData = dates.map((d) => +(dayMap.get(d)!.revenue / 100).toFixed(2));
  const cancelledData = dates.map((d) => dayMap.get(d)!.cancelled);
  const avgPartyData = dates.map((d) => {
    const { confirmed, partyTotal } = dayMap.get(d)!;
    return confirmed > 0 ? +(partyTotal / confirmed).toFixed(1) : 0;
  });

  const resourceMap = new Map<string, number>();
  for (const r of resourceRows) resourceMap.set(r.name, 0);
  for (const b of monthBookings) {
    if (b.status === "confirmed") {
      resourceMap.set(b.resourceName, (resourceMap.get(b.resourceName) ?? 0) + 1);
    }
  }
  const resourcePieData = [...resourceMap.entries()]
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const dowMap = [0, 0, 0, 0, 0, 0, 0];
  for (const b of monthBookings) {
    if (b.status === "confirmed") {
      const d = fmtDate(b.startAt, company.timezone);
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
      dowMap[dow]++;
    }
  }
  const sortedDow = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    day: DAYS_SHORT[i],
    value: dowMap[i],
  }));

  const chartLabel = { fontSize: 10, color: "#6b7280" };
  const chartGrid = { left: 40, right: 8, top: 8, bottom: 24 };

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
                  {s.done ? <CheckIcon className="h-4 w-4" /> : i + 1}
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

      {totalBookings > 0 && (
        <div className="grid gap-4 grid-cols-2">
          <SparklineCard label="Ingresos (30d)" value={`${(totalRevenue / 100).toFixed(2)} €`} data={revenueData} color="#22C55E" />
          <SparklineCard label="Reservas (30d)" value={String(totalBookings)} data={bookingVolumeData} color="#3B82F6" />
          <SparklineCard label="Cancelaciones" value={`${cancellationRate}%`} data={cancelledData} color="#EF4444" />
          <SparklineCard label="Prom. personas" value={avgPartySize} data={avgPartyData} color="#8B5CF6" />
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Reservas diarias (30 días)</h3>
          <Chart
            options={{
              grid: { ...chartGrid },
              xAxis: { type: "category", data: dates.map((d) => d.slice(5)), axisLabel: chartLabel, splitLine: { show: false } },
              yAxis: { type: "value", minInterval: 1, axisLabel: chartLabel, splitLine: { lineStyle: { color: "#f3f4f6" } } },
              tooltip: { trigger: "axis" },
              series: [{ type: "line", data: bookingVolumeData, smooth: true, lineStyle: { color: "#3B82F6", width: 2, shadowBlur: 6, shadowColor: "rgba(59,130,246,0.3)" }, areaStyle: { color: "rgba(59,130,246,0.15)" }, itemStyle: { color: "#3B82F6" }, symbol: "circle", symbolSize: 4 }],
            }}
            className="h-48"
          />
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Reservas por día de la semana</h3>
          <Chart
            options={{
              grid: { ...chartGrid },
              xAxis: { type: "category", data: sortedDow.map((d) => d.day), axisLabel: chartLabel, splitLine: { show: false } },
              yAxis: { type: "value", minInterval: 1, axisLabel: chartLabel, splitLine: { lineStyle: { color: "#f3f4f6" } } },
              tooltip: { trigger: "axis" },
              series: [{ type: "bar", data: sortedDow.map((d) => d.value), itemStyle: { color: "#3B82F6", borderRadius: [4, 4, 0, 0], shadowBlur: 4, shadowColor: "rgba(59,130,246,0.2)" } }],
            }}
            className="h-48"
          />
        </div>
        {resourcePieData.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink mb-3">Distribución por recurso</h3>
            <Chart
              options={{
                series: [{ type: "pie", radius: ["35%", "65%"], data: resourcePieData, label: { show: true, position: "outside", fontSize: 10 }, emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" } } }],
                tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
              }}
              className="h-48"
            />
          </div>
        )}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Ingresos diarios (30 días)</h3>
          <Chart
            options={{
              grid: { left: 48, right: 8, top: 8, bottom: 24 },
              xAxis: { type: "category", data: dates.map((d) => d.slice(5)), axisLabel: chartLabel, splitLine: { show: false } },
              yAxis: { type: "value", axisLabel: { ...chartLabel, formatter: "{value}€" }, splitLine: { lineStyle: { color: "#f3f4f6" } } },
              tooltip: { trigger: "axis" },
              series: [{ type: "bar", data: revenueData, itemStyle: { color: "#22C55E", borderRadius: [4, 4, 0, 0], shadowBlur: 4, shadowColor: "rgba(34,197,94,0.2)" } }],
            }}
            className="h-48"
          />
        </div>
      </section>

      {historyRows.length > 0 && (
        <section data-tour="history" className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Últimas reservas</h2>
          <div className="card divide-y divide-border">
            {historyRows.map((b) => {
              const dateStr = new Intl.DateTimeFormat("es-ES", {
                timeZone: company.timezone,
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(b.startAt);
              return (
                <div key={b.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink truncate">{b.customerName}</p>
                    <p className="text-muted text-xs">
                      {b.resourceName} · {b.partySize}{" "}
                      {b.partySize === 1 ? "persona" : "personas"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs tabular-nums text-muted">{dateStr}</span>
                    <span
                      className={`badge ${
                        b.status === "confirmed" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
                      }`}
                    >
                      {b.status === "confirmed" ? "Completada" : "Cancelada"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

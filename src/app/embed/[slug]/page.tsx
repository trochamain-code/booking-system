import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { resources as resourcesSchema } from "@/lib/schema";
import { getCompanyBySlug, getAvailability, getAvailableDates } from "@/lib/booking-data";
import { DatePickerField } from "@/app/date-picker-field";
import { isDateStr } from "@/lib/validation";
import { contrastText } from "@/lib/color";
import { formatEuros } from "@/lib/validation";

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; party?: string; taken?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [maxCapacity] = await db
    .select({ max: resourcesSchema.capacity })
    .from(resourcesSchema)
    .where(eq(resourcesSchema.companyId, company.id))
    .orderBy(desc(resourcesSchema.capacity))
    .limit(1);

  const maxPartySize = Math.max(1, maxCapacity?.max ?? 12);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const party = sp.party ? Math.max(1, Math.min(parseInt(sp.party, 10) || 1, maxPartySize)) : 2;
  const date = sp.date && isDateStr(sp.date) ? sp.date : "";

  const [slots, availableDates] = await Promise.all([
    date ? getAvailability(company, date, party) : null,
    getAvailableDates(company, party),
  ]);

  const prettyDate = date
    ? new Intl.DateTimeFormat("es-ES", {
        timeZone: company.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(`${date}T12:00:00Z`))
    : "";

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6" style={{ ["--brand" as string]: company.primaryColor, ["--brand-text" as string]: contrastText(company.primaryColor) }}>
      <div className="card overflow-hidden">
        <div style={{ height: "4px", backgroundColor: "var(--brand)" }} />

        <header className="flex items-center gap-4 p-5">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: "var(--brand)" }}
              aria-hidden
            >
              {company.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-ink">{company.name}</h1>
            <p className="text-xs text-muted">{company.welcomeText || "Reserva tu mesa"}</p>
          </div>
        </header>

        <div className="p-5 pt-0">
          {sp.taken && (
            <p role="alert" className="mb-4 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
              Ese horario se acaba de ocupar — elige otro, por favor.
            </p>
          )}
          {sp.error === "rate" && (
            <p role="alert" className="mb-4 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
              Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.
            </p>
          )}

          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="party">
                Personas
              </label>
              <select id="party" name="party" defaultValue={party} className="select">
                {Array.from({ length: maxPartySize }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="date">
                Fecha
              </label>
              <DatePickerField name="date" defaultValue={date || today} min={today} label="Fecha" availableDates={[...availableDates]} />
            </div>
            <button className="btn btn-brand">Buscar horarios</button>
          </form>

          {slots && (
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-medium text-muted first-letter:uppercase">
                {slots.length > 0 ? `${prettyDate} · ${party} personas` : "Sin horarios disponibles"}
              </h2>
              {slots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <Link
                      key={s.startAt}
                      href={`/embed/${slug}/book?date=${date}&party=${party}&startAt=${encodeURIComponent(s.startAt)}`}
                      className="chip flex-col gap-0 py-2"
                    >
                      <span>{s.time}</span>
                      {s.priceCents !== null && s.priceCents > 0 && (
                        <span className="text-[10px] font-normal opacity-75">
                          {formatEuros(s.priceCents).replace(".", ",")} €/pers
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Prueba con otra fecha o un grupo más pequeño.</p>
              )}
            </section>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-subtle">Reservas gestionadas de forma segura</p>
    </main>
  );
}

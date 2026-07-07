import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug, getAvailability } from "@/lib/booking-data";

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; party?: string; taken?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const party = sp.party ? Math.max(1, parseInt(sp.party, 10) || 1) : 2;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : "";
  const slots = date ? await getAvailability(company, date, party) : null;

  const prettyDate = date
    ? new Intl.DateTimeFormat("es-ES", {
        timeZone: company.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(`${date}T12:00:00Z`))
    : "";

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6" style={{ ["--brand" as string]: company.primaryColor }}>
      <div className="card overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border p-5">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-semibold text-white"
              style={{ backgroundColor: "var(--brand)" }}
              aria-hidden
            >
              {company.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-ink">{company.name}</h1>
            <p className="text-xs text-muted">Reserva tu mesa</p>
          </div>
        </header>

        <div className="p-5">
          {sp.taken && (
            <p role="alert" className="mb-4 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
              Ese horario se acaba de ocupar — elige otro, por favor.
            </p>
          )}

          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="party">
                Personas
              </label>
              <select id="party" name="party" defaultValue={party} className="select">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
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
              <input id="date" type="date" name="date" min={today} defaultValue={date || today} className="input" />
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
                      className="chip"
                    >
                      {s.time}
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

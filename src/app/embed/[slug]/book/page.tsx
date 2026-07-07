import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/booking-data";
import { createBooking } from "@/lib/booking-actions";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; party?: string; startAt?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const date = sp.date ?? "";
  const party = Math.max(1, parseInt(sp.party ?? "2", 10) || 2);
  const startAt = sp.startAt ?? "";

  const when = startAt
    ? new Intl.DateTimeFormat("es-ES", {
        timeZone: company.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(startAt))
    : "";

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6" style={{ ["--brand" as string]: company.primaryColor }}>
      <div className="card overflow-hidden">
        <header className="border-b border-border p-5">
          <Link
            href={`/embed/${slug}?date=${date}&party=${party}`}
            className="text-sm text-muted transition hover:text-ink"
          >
            ← Cambiar horario
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-ink">{company.name}</h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {when} · {party} personas
          </p>
        </header>

        <div className="p-5">
          {sp.error && (
            <p role="alert" className="mb-4 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              Introduce tu nombre y un correo válido.
            </p>
          )}

          <form action={createBooking} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="startAt" value={startAt} />
            <input type="hidden" name="partySize" value={party} />
            <div>
              <label className="label" htmlFor="customerName">
                Nombre
              </label>
              <input id="customerName" name="customerName" required autoComplete="name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Correo electrónico
              </label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Teléfono (opcional)
              </label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
            </div>
            <button className="btn btn-brand w-full">Confirmar reserva</button>
          </form>
        </div>
      </div>
    </main>
  );
}

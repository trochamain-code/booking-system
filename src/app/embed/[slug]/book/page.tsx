import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCompanyBySlug } from "@/lib/booking-data";
import { createBookingCheckout } from "@/lib/stripe-actions";
import { contrastText } from "@/lib/color";
import { SubmitButton } from "@/app/submit-button";
import { ChevronLeftIcon } from "@/app/icons";

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

  const startDate = startAt ? new Date(startAt) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    redirect(`/embed/${slug}?date=${encodeURIComponent(date)}&party=${party}`);
  }

  const when = new Intl.DateTimeFormat("es-ES", {
    timeZone: company.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startDate);

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6" style={{ ["--brand" as string]: company.primaryColor, ["--brand-text" as string]: contrastText(company.primaryColor) }}>
      <div className="card overflow-hidden">
        <div style={{ height: "4px", backgroundColor: "var(--brand)" }} />

        <header className="p-5">
          <Link
            href={`/embed/${slug}?date=${date}&party=${party}`}
            className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
          >
            <ChevronLeftIcon className="h-4 w-4" /> Cambiar horario
          </Link>
          <div className="mt-3 flex items-center gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: "var(--brand)" }}
                aria-hidden
              >
                {company.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-ink">{company.name}</h1>
              <p className="mt-0.5 text-sm text-muted">{company.welcomeText || "Reserva tu mesa"}</p>
              <p className="text-sm text-muted first-letter:uppercase">
                {when} · {party} personas
              </p>
            </div>
          </div>
        </header>

        <div className="p-5 pt-0">
          {sp.error && (
            <p role="alert" className="mb-4 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {sp.error === "payment"
                ? "No se pudo iniciar el pago. Inténtalo de nuevo o contacta con el establecimiento."
                : "Introduce tu nombre y un correo válido."}
            </p>
          )}

          <form action={createBookingCheckout} className="space-y-4">
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
            <div>
              <label className="label" htmlFor="comments">
                Comentarios (opcional)
              </label>
              <textarea
                id="comments"
                name="comments"
                rows={3}
                maxLength={500}
                placeholder="Alergias, trona, celebración…"
                className="input h-auto"
              />
            </div>
            <SubmitButton className="btn btn-brand w-full" pendingText="Confirmando…">
              Confirmar reserva
            </SubmitButton>
          </form>
        </div>
      </div>
    </main>
  );
}

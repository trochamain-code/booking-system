import { notFound, redirect } from "next/navigation";
import { getCompanyBySlug } from "@/lib/booking-data";
import { contrastText } from "@/lib/color";
import { StripeRedirect } from "./stripe-redirect";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const { slug } = await params;
  const { to } = await searchParams;

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  // Only ever forward to Stripe Checkout — anything else is an open-redirect attempt.
  const url = typeof to === "string" && to.startsWith("https://checkout.stripe.com/") ? to : null;
  if (!url) redirect(`/embed/${slug}`);

  return (
    <main
      className="mx-auto max-w-lg p-4 sm:p-6"
      style={{ ["--brand" as string]: company.primaryColor, ["--brand-text" as string]: contrastText(company.primaryColor) }}
    >
      <StripeRedirect url={url} />
      <div className="card overflow-hidden">
        <div style={{ height: "4px", backgroundColor: "var(--brand)" }} />
        <div className="p-8 text-center">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="mx-auto mb-4 h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-text)" }}
              aria-hidden
            >
              {company.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-semibold text-ink">Un último paso</h1>
          <p className="mt-2 text-sm text-muted">
            Te llevamos al pago seguro de Stripe para confirmar tu reserva. Si no se abre automáticamente, pulsa el
            botón.
          </p>
          <a href={url} target="_top" className="btn btn-brand mt-6">
            Continuar al pago seguro
          </a>
          <p className="mt-4 text-xs text-subtle">Pago procesado por Stripe. No almacenamos los datos de tu tarjeta.</p>
        </div>
      </div>
    </main>
  );
}

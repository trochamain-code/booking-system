import { updateBranding } from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";
import { contrastText } from "@/lib/color";
import { CopyButton } from "@/app/copy-button";
import { LogoUploader } from "./logo-uploader";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { company } = await requireCompany();
  const { error } = await searchParams;

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const widgetUrl = `${appUrl}/embed/${company.slug}`;
  const snippet = `<iframe src="${widgetUrl}" width="100%" height="700" style="border:0"></iframe>`;
  const brandText = contrastText(company.primaryColor);
  const errorText =
    error === "logo"
      ? "La URL del logo debe empezar por http:// o https://."
      : error === "color"
        ? "El color debe ser un valor hexadecimal válido (p. ej. #b91c1c)."
        : null;

  return (
    <div className="max-w-2xl space-y-10">
      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Personalización</h1>
          <p className="mt-1 text-sm text-muted">Configura la imagen de tu marca en emails y widget de reservas.</p>
        </header>

        <form action={updateBranding} data-tour="branding" className="card space-y-5 p-6">
          {errorText && (
            <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {errorText}
            </p>
          )}

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink">Marca visual</legend>
            <LogoUploader logoUrl={company.logoUrl} companyName={company.name} />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="logoUrl">
                  O pega una URL externa
                </label>
                <input
                  id="logoUrl"
                  name="logoUrl"
                  type="url"
                  // Remount when the uploader changes the logo so the stale
                  // defaultValue can't overwrite the fresh URL on form save.
                  key={company.logoUrl ?? "none"}
                  defaultValue={company.logoUrl ?? ""}
                  placeholder="https://…/logo.png"
                  className="input"
                />
                <p className="mt-1 text-xs text-muted">Vacía este campo y guarda para quitar el logo.</p>
              </div>
              <div>
                <label className="label" htmlFor="primaryColor">
                  Color principal
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="primaryColor"
                    name="primaryColor"
                    type="color"
                    defaultValue={company.primaryColor}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-surface p-1"
                  />
                  <span className="font-mono text-sm text-muted">{company.primaryColor}</span>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink">Widget</legend>
            <div>
              <label className="label" htmlFor="welcomeText">
                Mensaje de bienvenida
              </label>
              <input
                id="welcomeText"
                name="welcomeText"
                defaultValue={company.welcomeText ?? ""}
                placeholder="Ej: Reserva tu experiencia en nuestro local"
                maxLength={120}
                className="input"
              />
              <p className="mt-1 text-xs text-muted">Se muestra en el encabezado del widget de reservas.</p>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink">Correos electrónicos</legend>
            <div>
              <label className="label" htmlFor="senderName">
                Nombre del remitente
              </label>
              <input
                id="senderName"
                name="senderName"
                defaultValue={company.senderName ?? ""}
                placeholder={company.name}
                maxLength={60}
                className="input"
              />
              <p className="mt-1 text-xs text-muted">
                Se muestra como remitente en los correos. Si se deja vacío se usa &quot;{company.name}&quot;.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="contactInfo">
                Información de contacto (pie de correo)
              </label>
              <textarea
                id="contactInfo"
                name="contactInfo"
                defaultValue={company.contactInfo ?? ""}
                placeholder={"Dirección\nTeléfono\nWeb o redes"}
                rows={3}
                maxLength={300}
                className="input resize-none"
              />
              <p className="mt-1 text-xs text-muted">
                Aparecerá al pie de los correos enviados a clientes. Máximo 300 caracteres.
              </p>
            </div>
          </fieldset>

          <button className="btn btn-primary">Guardar cambios</button>
        </form>
      </section>

      {/* Live preview */}
      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-ink">Vista previa del widget</h2>
          <p className="mt-1 text-sm text-muted">Así se verá el widget en tu web con la configuración actual.</p>
        </header>
        <div
          className="card overflow-hidden"
          style={{ ["--brand" as string]: company.primaryColor, ["--brand-text" as string]: brandText }}
        >
          <div style={{ height: "4px", backgroundColor: "var(--brand)" }} />
          <header className="flex items-center gap-4 p-5">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-text)" }}
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
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="label mb-1.5">Personas</div>
                <div className="h-11 w-24 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                  2
                </div>
              </div>
              <div>
                <div className="label mb-1.5">Fecha</div>
                <div className="h-11 w-44 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                  Hoy
                </div>
              </div>
              <div
                className="h-11 rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-text)" }}
              >
                Buscar horarios
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              {["19:00", "19:30", "20:00", "20:30", "21:00"].map((t) => (
                <div
                  key={t}
                  className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                  style={{ borderColor: "color-mix(in srgb, var(--brand) 40%, transparent)", color: "var(--brand)" }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-ink">Pagos con Stripe</h2>
        </header>
        <div className="card p-6">
          {company.stripeEnabled ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-success">Stripe activado</p>
              <p className="text-xs text-muted">
                Los recursos con precio asignado requerirán pago al reservar.
                Las claves de Stripe las configura el administrador del sistema.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Stripe no está activado. Las reservas son gratuitas. Contacta con el administrador para activar pagos.
            </p>
          )}
        </div>
      </section>

      <section data-tour="embed" className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-ink">Incrustar en tu web</h2>
          <p className="mt-1 text-sm text-muted">Pega este fragmento donde quieras que aparezca el widget de reservas.</p>
        </header>
        <textarea
          readOnly
          rows={3}
          value={snippet}
          aria-label="Fragmento para incrustar"
          className="w-full resize-none rounded-xl border border-border bg-surface-2 p-3 font-mono text-xs text-ink"
        />
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton text={snippet} label="Copiar código" />
          <CopyButton text={widgetUrl} label="Copiar enlace directo" />
        </div>
        <p className="text-sm text-muted">
          O enlaza directamente:{" "}
          <a href={widgetUrl} target="_blank" rel="noreferrer" className="link">
            {widgetUrl}
          </a>
        </p>
      </section>
    </div>
  );
}

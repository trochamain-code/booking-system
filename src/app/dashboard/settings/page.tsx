import { eq } from "drizzle-orm";
import { toggleStripe } from "@/lib/company-actions";
import { saveCancellationPolicy, deleteCancellationPolicy } from "@/lib/cancellation-policy";
import { requireCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { cancellationPolicies, companies } from "@/lib/schema";
import { contrastText } from "@/lib/color";
import { CopyButton } from "@/app/copy-button";
import { LogoUploader } from "@/app/logo-uploader";
import { uploadCompanyLogo } from "@/lib/upload-actions";
import { SubmitButton } from "@/app/submit-button";
import { Toggle } from "@/app/toggle";
import { ArrowRightIcon } from "@/app/icons";
import { SettingsForm } from "@/app/settings-form";

export default async function SettingsPage() {
  const { company } = await requireCompany();

  const stripeRow = await db
    .select({
      stripeEnabled: companies.stripeEnabled,
      stripeSecretKey: companies.stripeSecretKey,
    })
    .from(companies)
    .where(eq(companies.id, company.id))
    .then((r) => r[0]);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const widgetUrl = `${appUrl}/embed/${company.slug}`;
  const brandText = contrastText(company.primaryColor);

  const policies = await db
    .select()
    .from(cancellationPolicies)
    .where(eq(cancellationPolicies.companyId, company.id))
    .orderBy(cancellationPolicies.ruleType, cancellationPolicies.thresholdMinutes);

  const afterBookingRules = policies.filter((p) => p.ruleType === "after_booking");
  const beforeEventRules = policies.filter((p) => p.ruleType === "before_event");

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Personalización</h1>
          <p className="mt-1 text-sm text-muted">Configura la imagen de tu marca en emails y widget de reservas.</p>
        </header>

        <SettingsForm>
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink">Marca visual</legend>
            <LogoUploader logoUrl={company.logoUrl} companyName={company.name} action={uploadCompanyLogo} />
            <div className="grid gap-5 sm:grid-cols-2">
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

          <SubmitButton pendingText="Guardando…">Guardar cambios</SubmitButton>
        </SettingsForm>
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
            <div className="mt-6 flex flex-wrap gap-2">
              {["19:00", "19:30", "20:00", "20:30", "21:00"].map((t) => (
                <div key={t} className="chip pointer-events-none">
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
          {stripeRow.stripeSecretKey ? (
            <form action={toggleStripe} className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-sm font-medium ${stripeRow.stripeEnabled ? "text-success" : "text-muted"}`}>
                  {stripeRow.stripeEnabled ? "Stripe activado" : "Stripe desactivado"}
                </p>
                <p className="text-xs text-muted mt-1">
                  {stripeRow.stripeEnabled
                    ? "Los recursos con precio asignado requerirán pago al reservar."
                    : "Las reservas se crean sin cobro, incluso si tienen precio."}
                </p>
              </div>
              <Toggle
                submitOnChange
                defaultChecked={stripeRow.stripeEnabled}
                label={stripeRow.stripeEnabled ? "Desactivar Stripe" : "Activar Stripe"}
              />
            </form>
          ) : (
            <p className="text-sm text-muted">
              Stripe no está configurado. Contacta con el administrador del sistema para que añada las claves de Stripe.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-ink">Política de cancelación</h2>
          <p className="mt-1 text-sm text-muted">
            Define cuánto se reembolsa al cliente según cuándo cancele. Las reglas se evalúan en orden: primero el
            periodo de gracia tras la reserva, luego la antelación respecto al inicio de la reserva.
          </p>
        </header>

        <div className="card divide-y divide-border p-6">
          <div className="pb-5">
            <h3 className="text-sm font-semibold text-ink">Periodo de gracia (tras la reserva)</h3>
            <p className="text-xs text-muted">Se aplica si la cancelación ocurre dentro de los minutos indicados.</p>
            {afterBookingRules.length > 0 && (
              <ul className="mt-3 space-y-2">
                {afterBookingRules.map((rule) => (
                  <li key={rule.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      Dentro de {rule.thresholdMinutes} min
                      <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-subtle" />
                      {rule.refundPercent}% reembolso
                    </span>
                    <form action={deleteCancellationPolicy}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button className="row-action">Quitar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveCancellationPolicy} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="ruleType" value="after_booking" />
              <div>
                <label className="label" htmlFor="grace-minutes">Dentro de</label>
                <input id="grace-minutes" name="thresholdMinutes" type="number" min={0} defaultValue={10} className="input w-24" />
              </div>
              <span className="text-sm text-muted pb-2">minutos</span>
              <div>
                <label className="label" htmlFor="grace-percent">Reembolsar</label>
                <select id="grace-percent" name="refundPercent" defaultValue="100" className="select">
                  <option value="0">0%</option>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                </select>
              </div>
              <SubmitButton className="btn btn-ghost btn-sm">Añadir regla</SubmitButton>
            </form>
          </div>

          <div className="pt-5">
            <h3 className="text-sm font-semibold text-ink">Antelación antes del evento</h3>
            <p className="text-xs text-muted">
              Se aplica si la cancelación ocurre al menos con esa antelación. Se evalúa la regla más exigente primero.
            </p>
            {beforeEventRules.length > 0 && (
              <ul className="mt-3 space-y-2">
                {beforeEventRules.map((rule) => (
                  <li key={rule.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      ≥ {rule.thresholdMinutes} min antes
                      <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-subtle" />
                      {rule.refundPercent}% reembolso
                    </span>
                    <form action={deleteCancellationPolicy}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button className="row-action">Quitar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveCancellationPolicy} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="ruleType" value="before_event" />
              <div>
                <label className="label" htmlFor="before-minutes">Al menos</label>
                <input id="before-minutes" name="thresholdMinutes" type="number" min={0} defaultValue={1440} className="input w-24" />
              </div>
              <span className="text-sm text-muted pb-2">minutos antes</span>
              <div>
                <label className="label" htmlFor="before-percent">Reembolsar</label>
                <select id="before-percent" name="refundPercent" defaultValue="100" className="select">
                  <option value="0">0%</option>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                </select>
              </div>
              <SubmitButton className="btn btn-ghost btn-sm">Añadir regla</SubmitButton>
            </form>
          </div>
        </div>
      </section>

      <section data-tour="embed" className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-ink">Tu widget de reservas</h2>
          <p className="mt-1 text-sm text-muted">Comparte este enlace con tus clientes para que puedan reservar.</p>
        </header>
        <div className="card flex flex-wrap items-center gap-4 p-6">
          <a href={widgetUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
            Abrir widget
          </a>
          <CopyButton text={widgetUrl} label="Copiar enlace" />
          <p className="text-xs text-muted break-all">{widgetUrl}</p>
        </div>
      </section>
    </div>
  );
}

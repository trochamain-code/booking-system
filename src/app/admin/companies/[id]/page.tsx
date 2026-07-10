import { and, asc, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { companies, users, resources, openingHours, closures, bookings, cancellationPolicies } from "@/lib/schema";
import { dayRangeUtc } from "@/lib/availability";
import {
  updateCompany,
  updateCompanyStripe,
  deleteCompany,
  adminAddResource,
  adminUpdateResource,
  adminDeleteResource,
  adminAddOpeningHour,
  adminDeleteOpeningHour,
  adminAddClosure,
  adminDeleteClosure,
  adminCancelBooking,
  adminUpdateOwner,
} from "@/lib/admin-actions";
import { adminSaveCancellationPolicy, adminDeleteCancellationPolicy } from "@/lib/cancellation-policy";
import { isDateStr, COMMON_TZS, formatEuros, tzLabel } from "@/lib/validation";
import { ConfirmDeleteButton } from "@/app/confirm-delete-button";
import { ConfirmForm } from "../../confirm-form";
import { CopyButton } from "@/app/copy-button";
import { LogoUploader } from "@/app/logo-uploader";
import { adminUploadCompanyLogo } from "@/lib/upload-actions";
import { PasswordField } from "../../../password-field";
import { DatePickerField } from "../../../date-picker-field";
import { SubmitButton } from "@/app/submit-button";
import { Toggle } from "@/app/toggle";
import { ChevronLeftIcon, ArrowRightIcon, CheckIcon } from "@/app/icons";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string; date?: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error;

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) return <p className="p-8 text-muted">Empresa no encontrada.</p>;

  const [rows, hours, closed, owners, policies] = await Promise.all([
    db
      .select()
      .from(resources)
      .where(eq(resources.companyId, id))
      .orderBy(asc(resources.name)),
    db
      .select()
      .from(openingHours)
      .where(eq(openingHours.companyId, id))
      .orderBy(asc(openingHours.dayOfWeek), asc(openingHours.openTime)),
    db
      .select()
      .from(closures)
      .where(eq(closures.companyId, id))
      .orderBy(asc(closures.date)),
    db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.companyId, id), eq(users.role, "owner")))
      .limit(1),
    db
      .select()
      .from(cancellationPolicies)
      .where(eq(cancellationPolicies.companyId, id))
      .orderBy(cancellationPolicies.ruleType, cancellationPolicies.thresholdMinutes),
  ]);

  const afterBookingRules = policies.filter((p) => p.ruleType === "after_booking");
  const beforeEventRules = policies.filter((p) => p.ruleType === "before_event");

  const owner = owners[0];

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = sp.date && isDateStr(sp.date) ? sp.date : today;
  const { start, end } = dayRangeUtc(date, company.timezone);
  const bookingRows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      partySize: bookings.partySize,
      customerName: bookings.customerName,
      email: bookings.email,
      phone: bookings.phone,
      status: bookings.status,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(and(eq(bookings.companyId, id), gte(bookings.startAt, start), lt(bookings.startAt, end)))
    .orderBy(asc(bookings.startAt));

  const todayHeading = new Intl.DateTimeFormat("es-ES", {
    timeZone: company.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat("es-ES", { timeZone: company.timezone, hour: "2-digit", minute: "2-digit" }).format(d);

  const widgetUrl = `${process.env.APP_URL ?? "https://booking.host-ia.online"}/embed/${company.slug}`;
  const snippet = `<iframe src="${widgetUrl}" width="100%" height="700" frameborder="0" style="border-radius:12px"></iframe>`;

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface shadow-[var(--shadow-xs)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"><ChevronLeftIcon className="h-4 w-4" /> Volver</Link>
            <div>
              <h1 className="text-lg font-semibold text-ink">{company.name}</h1>
              <p className="text-xs text-muted">/{company.slug} · {tzLabel(company.timezone)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {error && (
          <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
            {error === "email" ? "Ese correo ya está en uso por otro usuario." : "No se pudo guardar. Comprueba los datos."}
          </p>
        )}
        {sp.updated && (
          <p role="status" className="rounded-xl bg-success-bg px-3 py-2 text-sm text-success">
            Empresa actualizada.
          </p>
        )}

        {/* Branding */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Datos de la empresa</h2>
          <form action={updateCompany} className="card grid gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="id" value={company.id} />
            <input type="hidden" name="redirectTo" value={`/admin/companies/${company.id}`} />
            <div>
              <label className="label" htmlFor="name">Nombre</label>
              <input id="name" name="name" defaultValue={company.name} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="slug">Slug</label>
              <input id="slug" name="slug" defaultValue={company.slug} required className="input font-mono text-sm" />
            </div>
            <div>
              <label className="label" htmlFor="timezone">Zona horaria</label>
              <select id="timezone" name="timezone" required className="select font-mono text-sm">
                {COMMON_TZS.map((tz) => <option key={tz} value={tz} selected={company.timezone === tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="color">Color principal</label>
              <input id="color" name="primaryColor" type="color" defaultValue={company.primaryColor} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-surface p-1" />
            </div>
            <div className="sm:col-span-2">
              <LogoUploader
                logoUrl={company.logoUrl}
                companyName={company.name}
                action={adminUploadCompanyLogo}
                companyId={company.id}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="logo">O pega una URL externa</label>
              <input
                id="logo"
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
            <div className="sm:col-span-2">
              <label className="label" htmlFor="welcome">Texto de bienvenida</label>
              <input id="welcome" name="welcomeText" defaultValue={company.welcomeText ?? ""} placeholder="Reserva tu experiencia" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="sender">Nombre remitente (email)</label>
              <input id="sender" name="senderName" defaultValue={company.senderName} placeholder={company.name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="contact">Contacto (pie de email)</label>
              <input id="contact" name="contactInfo" defaultValue={company.contactInfo ?? ""} placeholder="Dirección / teléfono" className="input" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Guardando…">Guardar cambios</SubmitButton>
            </div>
          </form>
        </section>

        {/* Owner */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Propietario</h2>
          <form action={adminUpdateOwner} className="card grid gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="companyId" value={id} />
            <div>
              <label className="label" htmlFor="owner-email">Correo</label>
              <input id="owner-email" name="email" type="email" defaultValue={owner?.email ?? ""} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="owner-password">Nueva contraseña (dejar vacío para no cambiar)</label>
              <PasswordField id="owner-password" name="password" minLength={8} />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Guardando…">Actualizar propietario</SubmitButton>
            </div>
          </form>
        </section>

        {/* Widget */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Widget de reservas</h2>
          <div className="card flex flex-wrap items-center gap-4 p-6">
            <a href={widgetUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Abrir widget
            </a>
            <CopyButton text={snippet} label="Copiar código" />
            <p className="text-xs text-muted">
              {widgetUrl}
            </p>
          </div>
        </section>

        {/* Stripe */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Stripe</h2>
          {error === "stripe_secret" && (
            <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              Clave secreta inválida o ausente. Debe empezar por sk_live_, sk_test_, rk_live_ o rk_test_ y es obligatoria para activar pagos.
            </p>
          )}
          {error === "stripe_pub" && (
            <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              Clave publicable inválida. Debe empezar por pk_live_ o pk_test_.
            </p>
          )}
          {error === "stripe_webhook" && (
            <p role="alert" className="rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
              Las claves se guardaron, pero no se pudo crear el webhook en Stripe. Los pagos funcionan igualmente;
              vuelve a guardar para reintentar la creación del webhook.
            </p>
          )}
          <form action={updateCompanyStripe} className="card grid gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="id" value={company.id} />
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <Toggle name="stripeEnabled" defaultChecked={company.stripeEnabled} label="Activar pagos con Stripe" />
                <span className="text-sm font-medium text-ink">Activar pagos con Stripe</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="stripe-secret">Clave secreta (sk_live_... / sk_test_...)</label>
              {/* Never echo the stored secret back into the page — empty means "keep the saved key". */}
              <input
                id="stripe-secret"
                name="stripeSecretKey"
                type="password"
                autoComplete="off"
                placeholder={company.stripeSecretKey ? "Guardada — dejar vacío para mantenerla" : "sk_live_..."}
                className="input font-mono text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="stripe-pub">Clave publicable (pk_live_... / pk_test_...)</label>
              <input
                id="stripe-pub"
                name="stripePublishableKey"
                type="text"
                autoComplete="off"
                placeholder={company.stripePublishableKey ? "Guardada — dejar vacío para mantenerla" : "pk_live_..."}
                className="input font-mono text-sm"
              />
            </div>
            {company.stripeSecretKey && (
              <div className="sm:col-span-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                {company.stripeWebhookSecret ? (
                  <p className="inline-flex items-center gap-1.5 text-success">
                    <CheckIcon className="h-4 w-4 shrink-0" /> Webhook de confirmación configurado — las reservas pagadas se
                    crean aunque el cliente no vuelva de Stripe.
                  </p>
                ) : (
                  <p className="text-warn">
                    Webhook de confirmación pendiente — se creará automáticamente al guardar.
                  </p>
                )}
              </div>
            )}
            {(company.stripeSecretKey || company.stripePublishableKey) && (
              <div className="sm:col-span-2">
                <label className="flex items-center gap-3">
                  <input type="checkbox" name="stripeClear" className="h-4 w-4 accent-[var(--color-primary)]" />
                  <span className="text-sm text-muted">Borrar las claves guardadas (desactiva los pagos)</span>
                </label>
              </div>
            )}
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Guardando…">Guardar Stripe</SubmitButton>
            </div>
          </form>
        </section>

        {/* Cancellation policies */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Política de cancelación</h2>
          <div className="card divide-y divide-border p-6">
            <div className="pb-5">
              <h3 className="text-sm font-semibold text-ink">Periodo de gracia (tras la reserva)</h3>
              <p className="text-xs text-muted">Se aplica si la cancelación ocurre dentro de los minutos indicados.</p>
              {afterBookingRules.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {afterBookingRules.map((rule) => (
                    <li key={rule.id} className="flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-ink">Dentro de {rule.thresholdMinutes} min <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-subtle" /> {rule.refundPercent}% reembolso</span>
                      <form action={adminDeleteCancellationPolicy}>
                        <input type="hidden" name="id" value={rule.id} />
                        <input type="hidden" name="companyId" value={id} />
                        <button className="row-action">Quitar</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={adminSaveCancellationPolicy} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="companyId" value={id} />
                <input type="hidden" name="ruleType" value="after_booking" />
                <div>
                  <label className="label" htmlFor="admin-grace-minutes">Dentro de</label>
                  <input id="admin-grace-minutes" name="thresholdMinutes" type="number" min={0} defaultValue={10} className="input w-24" />
                </div>
                <span className="text-sm text-muted pb-2">minutos</span>
                <div>
                  <label className="label" htmlFor="admin-grace-percent">Reembolsar</label>
                  <select id="admin-grace-percent" name="refundPercent" defaultValue="100" className="select">
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
              <p className="text-xs text-muted">Se aplica si la cancelación ocurre al menos con esa antelación.</p>
              {beforeEventRules.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {beforeEventRules.map((rule) => (
                    <li key={rule.id} className="flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-ink">≥ {rule.thresholdMinutes} min antes <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-subtle" /> {rule.refundPercent}% reembolso</span>
                      <form action={adminDeleteCancellationPolicy}>
                        <input type="hidden" name="id" value={rule.id} />
                        <input type="hidden" name="companyId" value={id} />
                        <button className="row-action">Quitar</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={adminSaveCancellationPolicy} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="companyId" value={id} />
                <input type="hidden" name="ruleType" value="before_event" />
                <div>
                  <label className="label" htmlFor="admin-before-minutes">Al menos</label>
                  <input id="admin-before-minutes" name="thresholdMinutes" type="number" min={0} defaultValue={1440} className="input w-24" />
                </div>
                <span className="text text-muted pb-2">minutos antes</span>
                <div>
                  <label className="label" htmlFor="admin-before-percent">Reembolsar</label>
                  <select id="admin-before-percent" name="refundPercent" defaultValue="100" className="select">
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

        {/* Resources */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Recursos ({rows.length})</h2>
          {rows.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-muted">Aún no hay recursos.</p>
            </div>
          ) : (
            <ul className="card divide-y divide-border">
              {rows.map((r) => (
                  <li key={r.id}>
                    <form action={adminUpdateResource} className="flex flex-wrap items-center gap-3 p-4">
                      <input type="hidden" name="companyId" value={id} />
                      <input type="hidden" name="id" value={r.id} />
                      <input name="name" defaultValue={r.name} aria-label="Nombre" className="input min-w-40 flex-1" />
                      <label className="flex items-center gap-2 text-sm text-muted">
                        Plazas
                        <input name="capacity" type="number" min={1} defaultValue={r.capacity} aria-label="Aforo" className="input w-20" />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        Precio/plaza (€)
                        <input name="priceEuros" type="number" min={0} step="0.01" defaultValue={formatEuros(r.priceCents)} placeholder="Gratis" aria-label="Precio por plaza en euros" className="input w-24" />
                      </label>
                      <span className="inline-flex items-center gap-2 text-sm text-muted">
                        <Toggle name="active" defaultChecked={r.active} label={`Recurso activo: ${r.name}`} />
                        Activo
                      </span>
                      <SubmitButton className="btn btn-ghost btn-sm">Guardar</SubmitButton>
                      <ConfirmDeleteButton formAction={adminDeleteResource} id={r.id} fields={{ companyId: id }}>Eliminar</ConfirmDeleteButton>
                    </form>
                  </li>
              ))}
            </ul>
          )}
          <form action={adminAddResource} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="companyId" value={id} />
            <div className="flex-1">
              <label className="label" htmlFor="new-resource-name">Nuevo recurso</label>
              <input id="new-resource-name" name="name" required placeholder="Mesa 1" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="new-resource-capacity">Aforo</label>
              <input id="new-resource-capacity" name="capacity" type="number" min={1} defaultValue={2} className="input w-24" />
            </div>
            <div>
              <label className="label" htmlFor="new-resource-price">Precio/plaza (€)</label>
              <input id="new-resource-price" name="priceEuros" type="number" min={0} step="0.01" placeholder="Gratis" className="input w-24" />
            </div>
            <SubmitButton className="btn btn-primary">Añadir recurso</SubmitButton>
          </form>
        </section>

        {/* Opening hours */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Horario de apertura</h2>
          {hours.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-muted">Sin horario definido.</p>
            </div>
          ) : (
            <ul className="card divide-y divide-border">
              {hours.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-28 font-medium text-ink">{DAYS[h.dayOfWeek]}</span>
                  <span className="tabular-nums text-muted">{h.openTime} – {h.closeTime}</span>
                  <form action={adminDeleteOpeningHour} className="ml-auto">
                    <input type="hidden" name="companyId" value={id} />
                    <input type="hidden" name="id" value={h.id} />
                    <button className="row-action">Quitar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={adminAddOpeningHour} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="companyId" value={id} />
            <div>
              <label className="label" htmlFor="dayOfWeek">Día</label>
              <select id="dayOfWeek" name="dayOfWeek" className="select">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="openTime">Abre</label>
              <input id="openTime" name="openTime" type="time" required defaultValue="18:00" className="input w-32" />
            </div>
            <div>
              <label className="label" htmlFor="closeTime">Cierra</label>
              <input id="closeTime" name="closeTime" type="time" required defaultValue="23:00" className="input w-32" />
            </div>
            <SubmitButton className="btn btn-primary">Añadir tramo</SubmitButton>
          </form>
        </section>

        {/* Closures */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Cierres</h2>
          {closed.length > 0 && (
            <ul className="card divide-y divide-border">
              {closed.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-medium tabular-nums text-ink">{c.date}</span>
                  {c.reason && <span className="text-muted">{c.reason}</span>}
                  <form action={adminDeleteClosure} className="ml-auto">
                    <input type="hidden" name="companyId" value={id} />
                    <input type="hidden" name="id" value={c.id} />
                    <button className="row-action">Quitar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={adminAddClosure} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="companyId" value={id} />
            <div>
              <DatePickerField name="date" required label="Fecha" />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="closure-reason">Motivo (opcional)</label>
              <input id="closure-reason" name="reason" placeholder="Festivo" className="input" />
            </div>
            <SubmitButton className="btn btn-ghost">Añadir cierre</SubmitButton>
          </form>
        </section>

        {/* Bookings */}
        <section className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Reservas</h2>
              <p className="text-sm text-muted first-letter:uppercase">{todayHeading}</p>
            </div>
            <form method="get" className="flex items-end gap-2">
              <DatePickerField name="date" defaultValue={date} label="Fecha" />
              <button className="btn btn-ghost btn-sm">Ver</button>
            </form>
          </header>
          {bookingRows.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-muted">Sin reservas para esta fecha.</p>
            </div>
          ) : (
            <ul className="card divide-y divide-border">
              {bookingRows.map((b) => {
                const cancelled = b.status === "cancelled";
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="w-20 shrink-0 font-medium tabular-nums text-ink">{fmtTime(b.startAt)}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${cancelled ? "text-subtle line-through" : "text-ink"}`}>
                        {b.customerName}
                        <span className="ml-2 font-normal text-muted">{b.partySize} pers. · {b.resourceName}</span>
                      </p>
                      <p className="truncate text-xs text-muted">{b.email}{b.phone ? ` · ${b.phone}` : ""}</p>
                    </div>
                    {cancelled ? (
                      <span className="badge bg-danger-bg text-danger">Cancelada</span>
                    ) : (
                      <ConfirmForm message="¿Cancelar esta reserva?" action={adminCancelBooking}>
                        <input type="hidden" name="companyId" value={id} />
                        <input type="hidden" name="id" value={b.id} />
                        <button className="row-action">Cancelar</button>
                      </ConfirmForm>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Danger zone */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-danger">Zona de peligro</h2>
          <div className="card border-danger/30 p-6">
            <p className="text-sm text-muted">
              Eliminar esta empresa borrará todos los datos asociados (usuarios, recursos, horarios, reservas).
              Esta acción no se puede deshacer.
            </p>
            <ConfirmForm message={`¿Eliminar definitivamente "${company.name}"?`} action={deleteCompany} className="mt-4">
              <input type="hidden" name="id" value={company.id} />
              <button className="btn btn-danger">Eliminar empresa</button>
            </ConfirmForm>
          </div>
        </section>
      </main>
    </div>
  );
}

import { and, asc, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { companies, users, resources, openingHours, closures, bookings } from "@/lib/schema";
import { dayRangeUtc } from "@/lib/availability";
import {
  updateCompany,
  deleteCompany,
  adminAddResource,
  adminUpdateResource,
  adminAddOpeningHour,
  adminDeleteOpeningHour,
  adminAddClosure,
  adminDeleteClosure,
  adminCancelBooking,
  adminUpdateOwner,
} from "@/lib/admin-actions";
import { isDateStr, COMMON_TZS } from "@/lib/validation";
import { ConfirmForm } from "../../confirm-form";
import { CopyButton } from "../../copy-button";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; date?: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error;

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) return <p className="p-8 text-muted">Empresa no encontrada.</p>;

  const [rows, hours, closed, owners] = await Promise.all([
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
  ]);

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
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-muted transition hover:text-ink">&larr; Volver</Link>
            <div>
              <h1 className="text-lg font-semibold text-ink">{company.name}</h1>
              <p className="text-xs text-muted">/{company.slug} · {company.timezone}</p>
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

        {/* Branding */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Datos de la empresa</h2>
          <form action={updateCompany} className="card grid gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="id" value={company.id} />
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
              <label className="label" htmlFor="logo">URL del logo</label>
              <input id="logo" name="logoUrl" type="url" defaultValue={company.logoUrl ?? ""} placeholder="https://…/logo.png" className="input" />
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
              <button className="btn btn-primary">Guardar cambios</button>
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
              <input id="owner-password" name="password" type="password" minLength={8} className="input" />
            </div>
            <div className="sm:col-span-2">
              <button className="btn btn-primary">Actualizar propietario</button>
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
                      <input type="checkbox" name="active" defaultChecked={r.active} className="h-4 w-4 accent-[var(--color-primary)]" />
                      Activo
                    </label>
                    <button className="btn btn-ghost btn-sm">Guardar</button>
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
            <button className="btn btn-primary">Añadir recurso</button>
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
                    <button className="text-xs text-subtle transition hover:text-danger">Quitar</button>
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
            <button className="btn btn-primary">Añadir tramo</button>
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
                    <button className="text-xs text-subtle transition hover:text-danger">Quitar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={adminAddClosure} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="companyId" value={id} />
            <div>
              <label className="label" htmlFor="closure-date">Fecha</label>
              <input id="closure-date" name="date" type="date" required className="input" />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="closure-reason">Motivo (opcional)</label>
              <input id="closure-reason" name="reason" placeholder="Festivo" className="input" />
            </div>
            <button className="btn btn-ghost">Añadir cierre</button>
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
              <input type="date" name="date" defaultValue={date} aria-label="Fecha" className="input" />
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
                        <button className="text-xs text-subtle transition hover:text-danger">Cancelar</button>
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

import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { logout } from "@/lib/actions";
import { createCompany, updateCompany, deleteCompany } from "@/lib/admin-actions";
import { db } from "@/lib/db";
import { companies } from "@/lib/schema";
import { COMMON_TZS } from "@/lib/validation";
import { ConfirmForm } from "./confirm-form";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  created: { text: "Empresa creada.", ok: true },
  updated: { text: "Empresa actualizada.", ok: true },
  deleted: { text: "Empresa eliminada.", ok: true },
  invalid: { text: "Se requiere nombre, correo válido y una contraseña de 8+ caracteres.", ok: false },
  email: { text: "Ese correo de propietario ya está en uso.", ok: false },
  timezone: { text: "Zona horaria no válida. Usa un identificador IANA como Europe/Madrid.", ok: false },
  slug_taken: { text: "Ese slug ya está en uso por otra empresa.", ok: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireRole("super_admin");
  const params = await searchParams;
  const message = params.created ? MESSAGES.created : params.error ? MESSAGES[params.error] : null;

  const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">Administración</h1>
            <p className="text-xs text-muted">Plataforma · super admin</p>
          </div>
          <form action={logout}>
            <button className="text-sm text-muted transition hover:text-ink">Cerrar sesión</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={`rounded-xl px-3 py-2 text-sm ${
              message.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
            }`}
          >
            {message.text}
          </p>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Empresas ({rows.length})</h2>
          {rows.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-medium text-ink">Aún no hay empresas</p>
              <p className="mt-1 text-sm text-muted">Crea la primera con el formulario de abajo.</p>
            </div>
          ) : (
            <div className="card divide-y divide-border">
              {rows.map((c) => (
                <details key={c.id} className="group">
                  <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundColor: c.primaryColor }}
                      aria-hidden
                    >
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{c.name}</p>
                      <p className="truncate text-xs text-muted">
                        /{c.slug} · {c.timezone}
                      </p>
                    </div>
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Gestionar
                    </Link>
                    <span className="text-xs text-muted transition group-open:rotate-180">&#9660;</span>
                  </summary>
                  <div className="border-t border-border p-4">
                    <form action={updateCompany} className="grid gap-4 sm:grid-cols-2">
                      <input type="hidden" name="id" value={c.id} />
                      <div>
                        <label className="label" htmlFor={`name-${c.id}`}>Nombre</label>
                        <input id={`name-${c.id}`} name="name" defaultValue={c.name} required className="input" />
                      </div>
                      <div>
                        <label className="label" htmlFor={`slug-${c.id}`}>Slug</label>
                        <input id={`slug-${c.id}`} name="slug" defaultValue={c.slug} required className="input font-mono text-sm" />
                      </div>
                      <div>
                        <label className="label" htmlFor={`timezone-${c.id}`}>Zona horaria</label>
                        <select id={`timezone-${c.id}`} name="timezone" required className="select font-mono text-sm">
                          {COMMON_TZS.map((tz) => <option key={tz} value={tz} selected={c.timezone === tz}>{tz}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor={`color-${c.id}`}>Color principal</label>
                        <input id={`color-${c.id}`} name="primaryColor" type="color" defaultValue={c.primaryColor} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-surface p-1" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor={`logo-${c.id}`}>URL del logo</label>
                        <input id={`logo-${c.id}`} name="logoUrl" type="url" defaultValue={c.logoUrl ?? ""} placeholder="https://…/logo.png" className="input" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor={`welcome-${c.id}`}>Texto de bienvenida (widget)</label>
                        <input id={`welcome-${c.id}`} name="welcomeText" defaultValue={c.welcomeText ?? ""} placeholder="Ej: Reserva tu experiencia" className="input" />
                      </div>
                      <div>
                        <label className="label" htmlFor={`sender-${c.id}`}>Nombre remitente (email)</label>
                        <input id={`sender-${c.id}`} name="senderName" defaultValue={c.senderName ?? ""} placeholder={c.name} className="input" />
                      </div>
                      <div>
                        <label className="label" htmlFor={`contact-${c.id}`}>Contacto (pie de email)</label>
                        <input id={`contact-${c.id}`} name="contactInfo" defaultValue={c.contactInfo ?? ""} placeholder="Dirección / teléfono" className="input" />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <button className="btn btn-primary">Guardar cambios</button>
                      </div>
                    </form>
                    <ConfirmForm message={`¿Eliminar "${c.name}" definitivamente?`} action={deleteCompany} className="mt-3">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-danger btn-sm">Eliminar empresa</button>
                    </ConfirmForm>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Nueva empresa</h2>
          <form action={createCompany} className="card grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Nombre de la empresa
              </label>
              <input id="name" name="name" required className="input" placeholder="Bistró del Sol" />
            </div>
            <div>
              <label className="label" htmlFor="timezone">
                Zona horaria (IANA)
              </label>
              <select id="timezone" name="timezone" required className="select font-mono text-sm">
                {COMMON_TZS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="email">
                Correo del propietario
              </label>
              <input id="email" name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Contraseña (8+)
              </label>
              <input id="password" name="password" type="password" required minLength={8} className="input" />
            </div>
            <div className="sm:col-span-2">
              <button className="btn btn-primary">Crear empresa y propietario</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

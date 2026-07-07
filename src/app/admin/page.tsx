import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { logout } from "@/lib/actions";
import { createCompany } from "@/lib/admin-actions";
import { db } from "@/lib/db";
import { companies } from "@/lib/schema";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  created: { text: "Empresa creada.", ok: true },
  invalid: { text: "Se requiere nombre, correo y una contraseña de 8+ caracteres.", ok: false },
  email: { text: "Ese correo de propietario ya está en uso.", ok: false },
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
            <ul className="card divide-y divide-border">
              {rows.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: c.primaryColor }}
                    aria-hidden
                  >
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{c.name}</p>
                    <p className="truncate text-xs text-muted">
                      /{c.slug} · {c.timezone}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
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
              <input id="timezone" name="timezone" defaultValue="Europe/Madrid" className="input" />
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

import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { resources } from "@/lib/schema";
import { addResource, updateResource } from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";
import { formatEuros } from "@/lib/validation";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { companyId } = await requireCompany();
  const { error } = await searchParams;
  const rows = await db
    .select()
    .from(resources)
    .where(eq(resources.companyId, companyId))
    .orderBy(asc(resources.name));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Recursos</h1>
        <p className="mt-1 text-sm text-muted">
          Mesas, sillas, pistas, salas… lo que se reserve. El aforo es cuántas personas admite; deja el precio vacío
          si la reserva es gratuita.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
          Revisa los datos: el nombre es obligatorio y el precio debe ser un importe válido (p. ej. 12.50).
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium text-ink">Aún no hay recursos</p>
          <p className="mt-1 text-sm text-muted">Añade el primero abajo para empezar a recibir reservas.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <form action={updateResource} className="flex flex-wrap items-center gap-3 p-4">
                <input type="hidden" name="id" value={r.id} />
                <input name="name" defaultValue={r.name} aria-label="Nombre del recurso" className="input min-w-40 flex-1" />
                <label className="flex items-center gap-2 text-sm text-muted">
                  Plazas
                  <input name="capacity" type="number" min={1} defaultValue={r.capacity} aria-label="Aforo" className="input w-20" />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  Precio (€)
                  <input
                    name="priceEuros"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={formatEuros(r.priceCents)}
                    placeholder="Gratis"
                    aria-label="Precio en euros"
                    className="input w-24"
                  />
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

      <form action={addResource} data-tour="add-resource" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1">
          <label className="label" htmlFor="new-resource-name">
            Nuevo recurso
          </label>
          <input id="new-resource-name" name="name" required placeholder="Mesa 1" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="new-resource-capacity">
            Aforo
          </label>
          <input id="new-resource-capacity" name="capacity" type="number" min={1} defaultValue={2} className="input w-24" />
        </div>
        <div>
          <label className="label" htmlFor="new-resource-price">
            Precio (€)
          </label>
          <input id="new-resource-price" name="priceEuros" type="number" min={0} step="0.01" placeholder="Gratis" className="input w-24" />
        </div>
        <button className="btn btn-primary">Añadir recurso</button>
      </form>
    </div>
  );
}

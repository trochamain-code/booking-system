import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { resources } from "@/lib/schema";
import { addResource, updateResource, deleteResource } from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";
import { formatEuros } from "@/lib/validation";
import { ConfirmDeleteButton } from "@/app/confirm-delete-button";
import { AutoSaveForm, SavingIndicator } from "@/app/auto-save-form";
import { SubmitButton } from "@/app/submit-button";
import { Toggle } from "@/app/toggle";

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
          Mesas, sillas, pistas, salas… lo que se reserve. El aforo es cuántas personas admite. El precio es por
          plaza; el total se calcula multiplicando por el número de personas. Deja el precio vacío si es gratuito.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={`${r.id}:${r.name}:${r.capacity}:${r.priceCents}:${r.active}`} className="card p-4">
              <AutoSaveForm action={updateResource} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <div>
                  <label className="label mb-1" htmlFor={`name-${r.id}`}>Recurso</label>
                  <input id={`name-${r.id}`} name="name" defaultValue={r.name} className="input w-full" />
                </div>
                <div>
                  <label className="label mb-1" htmlFor={`capacity-${r.id}`}>Plazas</label>
                  <input id={`capacity-${r.id}`} name="capacity" type="number" min={1} defaultValue={r.capacity} className="input w-full" />
                </div>
                <div>
                  <label className="label mb-1" htmlFor={`price-${r.id}`}>Precio / plaza (€)</label>
                  <input
                    id={`price-${r.id}`}
                    name="priceEuros"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={formatEuros(r.priceCents)}
                    placeholder="Gratis"
                    className="input w-full"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <Toggle name="active" defaultChecked={r.active} label={`Recurso activo: ${r.name}`} />
                    Activo
                  </span>
                  <SavingIndicator />
                  <span className="ml-auto">
                    <ConfirmDeleteButton formAction={deleteResource} id={r.id}>Eliminar</ConfirmDeleteButton>
                  </span>
                </div>
              </AutoSaveForm>
            </div>
          ))}
        </div>
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
            Precio/plaza (€)
          </label>
          <input id="new-resource-price" name="priceEuros" type="number" min={0} step="0.01" placeholder="Gratis" className="input w-24" />
        </div>
        <SubmitButton className="btn btn-primary w-full sm:w-auto">Añadir recurso</SubmitButton>
      </form>
    </div>
  );
}

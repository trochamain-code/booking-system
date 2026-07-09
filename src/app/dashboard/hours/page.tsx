import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { openingHours, closures } from "@/lib/schema";
import {
  addOpeningHour,
  updateOpeningHour,
  deleteOpeningHour,
  addClosure,
  deleteClosure,
} from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";
import { DatePickerField } from "@/app/date-picker-field";
import { AutoSaveForm, SavingIndicator } from "@/app/auto-save-form";
import { SubmitButton } from "@/app/submit-button";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { companyId } = await requireCompany();
  const { error } = await searchParams;

  const [hours, closed] = await Promise.all([
    db
      .select()
      .from(openingHours)
      .where(eq(openingHours.companyId, companyId))
      .orderBy(asc(openingHours.dayOfWeek), asc(openingHours.openTime)),
    db.select().from(closures).where(eq(closures.companyId, companyId)).orderBy(asc(closures.date)),
  ]);

  return (
    <div className="space-y-10">
      {error && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
          No se pudo guardar. Comprueba el día, la fecha y que la hora de apertura sea anterior a la de cierre.
        </p>
      )}
      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Horario de apertura</h1>
          <p className="mt-1 text-sm text-muted">
            Añade un tramo por día. Varios tramos el mismo día crean turnos partidos (p. ej. comida y cena).
          </p>
        </header>

        {hours.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-medium text-ink">Sin horario</p>
            <p className="mt-1 text-sm text-muted">Los clientes no verán disponibilidad hasta que añadas un horario.</p>
          </div>
        ) : (
          <ul className="card divide-y divide-border">
            {hours.map((h) => (
              // Keyed by the row's server values: after each save the row remounts
              // with fresh server data, so what you see is what got stored.
              <li key={`${h.id}:${h.dayOfWeek}:${h.openTime}:${h.closeTime}`}>
                <AutoSaveForm action={updateOpeningHour} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <input type="hidden" name="id" value={h.id} />
                  <select name="dayOfWeek" defaultValue={h.dayOfWeek} aria-label="Día" className="select w-full sm:w-32">
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input name="openTime" type="time" required defaultValue={h.openTime} aria-label="Hora de apertura" className="input min-w-0 flex-1 tabular-nums sm:w-32 sm:flex-none" />
                  <span className="text-muted">–</span>
                  <input name="closeTime" type="time" required defaultValue={h.closeTime} aria-label="Hora de cierre" className="input min-w-0 flex-1 tabular-nums sm:w-32 sm:flex-none" />
                  <SavingIndicator className="ml-auto" />
                  <button
                    formAction={deleteOpeningHour}
                    formNoValidate
                    className="row-action"
                    aria-label={`Quitar ${DAYS[h.dayOfWeek]} ${h.openTime}–${h.closeTime}`}
                  >
                    Quitar
                  </button>
                </AutoSaveForm>
              </li>
            ))}
          </ul>
        )}

        <form action={addOpeningHour} data-tour="add-hours" className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label" htmlFor="dayOfWeek">
              Día
            </label>
            <select id="dayOfWeek" name="dayOfWeek" className="select">
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="openTime">
              Abre
            </label>
            <input id="openTime" name="openTime" type="time" required defaultValue="18:00" className="input w-32" />
          </div>
          <div>
            <label className="label" htmlFor="closeTime">
              Cierra
            </label>
            <input id="closeTime" name="closeTime" type="time" required defaultValue="23:00" className="input w-32" />
          </div>
          <SubmitButton className="btn btn-primary w-full sm:w-auto">Añadir tramo</SubmitButton>
        </form>
      </section>

      <section data-tour="closures" className="space-y-5">
        <header>
          <h2 className="text-lg font-semibold text-ink">Cierres</h2>
          <p className="mt-1 text-sm text-muted">Bloquea un día entero — festivos, eventos privados, mantenimiento.</p>
        </header>

        {closed.length > 0 && (
          <ul className="card divide-y divide-border">
            {closed.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="font-medium tabular-nums text-ink">{c.date}</span>
                {c.reason && <span className="text-muted">{c.reason}</span>}
                <form action={deleteClosure} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="row-action" aria-label={`Quitar cierre ${c.date}`}>
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addClosure} className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <DatePickerField name="date" required label="Fecha" />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="closure-reason">
              Motivo (opcional)
            </label>
            <input id="closure-reason" name="reason" placeholder="Festivo" className="input" />
          </div>
          <SubmitButton className="btn btn-ghost w-full sm:w-auto">Añadir cierre</SubmitButton>
        </form>
      </section>
    </div>
  );
}

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
import { ConfirmDeleteButton } from "@/app/confirm-delete-button";
import { TrashIcon } from "@/app/icons";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_COLORS = ["#EF4444", "#3B82F6", "#06B6D4", "#22C55E", "#84CC16", "#F59E0B", "#8B5CF6"];

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
              const dayHours = hours.filter((h) => h.dayOfWeek === dayOfWeek);
              if (dayHours.length === 0) return null;
              return (
                <div key={dayOfWeek} className="card p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: DAY_COLORS[dayOfWeek] }}>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: DAY_COLORS[dayOfWeek] }} />
                    {DAYS[dayOfWeek]}
                  </h3>
                  <div className="space-y-3">
                    {dayHours.map((h) => (
                      <div key={`${h.id}:${h.openTime}:${h.closeTime}`} className="flex items-center gap-2 text-sm">
                        <AutoSaveForm action={updateOpeningHour} className="flex items-center gap-1.5 min-w-0 flex-1">
                          <input type="hidden" name="id" value={h.id} />
                          <input name="openTime" type="time" required defaultValue={h.openTime} className="input min-w-[4.5rem] flex-1 tabular-nums" />
                          <span className="text-muted shrink-0">–</span>
                          <input name="closeTime" type="time" required defaultValue={h.closeTime} className="input min-w-[4.5rem] flex-1 tabular-nums" />
                          <SavingIndicator className="shrink-0" />
                        </AutoSaveForm>
                        <ConfirmDeleteButton formAction={deleteOpeningHour} id={h.id}>
                          <TrashIcon className="h-4 w-4" />
                        </ConfirmDeleteButton>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form action={addOpeningHour} data-tour="add-hours" className="card space-y-3 p-4">
          <div>
            <label className="label" htmlFor="dayOfWeek">Día</label>
            <select id="dayOfWeek" name="dayOfWeek" className="select w-full">
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Horario</label>
            <div className="flex items-center gap-2">
              <input id="openTime" name="openTime" type="time" required defaultValue="18:00" className="input flex-1 tabular-nums" />
              <span className="text-muted shrink-0">–</span>
              <input id="closeTime" name="closeTime" type="time" required defaultValue="23:00" className="input flex-1 tabular-nums" />
            </div>
          </div>
          <SubmitButton className="btn btn-primary w-full">Añadir tramo</SubmitButton>
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
                    <TrashIcon className="h-4 w-4" />
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

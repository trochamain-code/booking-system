import { updateBranding } from "@/lib/company-actions";
import { requireCompany } from "@/lib/company";

export default async function SettingsPage() {
  const { company } = await requireCompany();

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const widgetUrl = `${appUrl}/embed/${company.slug}`;
  const snippet = `<iframe src="${widgetUrl}" width="100%" height="700" style="border:0"></iframe>`;

  return (
    <div className="max-w-2xl space-y-10">
      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Ajustes del widget</h1>
          <p className="mt-1 text-sm text-muted">Adapta el widget a tu marca.</p>
        </header>

        <form action={updateBranding} className="card space-y-5 p-6">
          <div>
            <label className="label" htmlFor="logoUrl">
              URL del logo
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={company.logoUrl ?? ""}
              placeholder="https://…/logo.png"
              className="input"
            />
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
          <button className="btn btn-primary">Guardar marca</button>
        </form>
      </section>

      <section className="space-y-3">
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

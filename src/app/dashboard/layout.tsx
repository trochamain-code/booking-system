import { logout } from "@/lib/actions";
import { requireCompany } from "@/lib/company";
import { DashboardNav } from "./nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireCompany();

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: company.primaryColor }}
              aria-hidden
            >
              {company.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{company.name}</p>
              <p className="truncate text-xs text-muted">{company.timezone}</p>
            </div>
          </div>
          <form action={logout}>
            <button className="text-sm text-muted transition hover:text-ink">Cerrar sesión</button>
          </form>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-2 pt-3">
          <DashboardNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

import { logout } from "@/lib/actions";
import { requireCompany } from "@/lib/company";
import { DashboardNav } from "./nav";
import { DashboardTour, TourButton } from "./tour";
import { LogoutIcon } from "@/app/icons";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireCompany();

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-surface shadow-[var(--shadow-xs)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pt-4 sm:px-6">
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
          <div className="flex shrink-0 items-center gap-3">
            <TourButton />
            <form action={logout}>
              <button className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
                <LogoutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <DashboardNav />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">{children}</main>
      <DashboardTour />
    </div>
  );
}

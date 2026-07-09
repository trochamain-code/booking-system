"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, CalendarIcon, GridIcon, ClockIcon, SettingsIcon } from "@/app/icons";

const TABS = [
  { href: "/dashboard", label: "Resumen", icon: HomeIcon },
  { href: "/dashboard/bookings", label: "Reservas", icon: CalendarIcon },
  { href: "/dashboard/resources", label: "Recursos", icon: GridIcon },
  { href: "/dashboard/hours", label: "Horario", icon: ClockIcon },
  { href: "/dashboard/settings", label: "Ajustes", icon: SettingsIcon },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel" data-tour="nav">
      {/* Mobile bottom nav — fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:static md:border-b md:border-t-0 md:pb-0">
        <div className="mx-auto flex max-w-5xl items-center justify-around md:justify-start md:gap-1 md:px-6 md:py-2">
          {TABS.map((t) => {
            const active = t.href === "/dashboard" ? pathname === t.href : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium transition md:flex-row md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
                  active
                    ? "text-ink md:bg-canvas"
                    : "text-subtle hover:text-ink"
                }`}
              >
                <Icon />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 12L12 3l9 9" /><path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

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
    <nav aria-label="Secciones del panel">
      {/* Mobile bottom nav — fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface md:static md:border-t-0">
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

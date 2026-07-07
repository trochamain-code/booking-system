"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/bookings", label: "Reservas" },
  { href: "/dashboard/resources", label: "Recursos" },
  { href: "/dashboard/hours", label: "Horario" },
  { href: "/dashboard/settings", label: "Ajustes" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav data-tour="nav" className="flex gap-1 overflow-x-auto" aria-label="Secciones del panel">
      {TABS.map((t) => {
        const active = t.href === "/dashboard" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-canvas text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { SparkleIcon } from "@/app/icons";

const DONE_KEY = "dashboard-tour-done";
const STEP_KEY = "dashboard-tour-step";

type Router = { push(href: string): void };

type TourStep = {
  path: string;
  selector: string;
  title: string;
  description: string;
};

// Ordered as a setup story: overview → resources → hours → bookings → share.
// Each selector must exist unconditionally on its page.
const STEPS: TourStep[] = [
  {
    path: "/dashboard",
    selector: '[data-tour="nav"]',
    title: "¡Bienvenido a tu panel!",
    description:
      "Te enseñamos cómo funciona en un minuto. Con estas pestañas te mueves entre el resumen, las reservas de tus clientes y la configuración de tu negocio.",
  },
  {
    path: "/dashboard",
    selector: '[data-tour="stats"]',
    title: "Tu actividad de un vistazo",
    description:
      "Cuántas reservas tienes hoy, las de los próximos 7 días y tus recursos activos. Haz clic en cualquier tarjeta para ir al detalle.",
  },
  {
    path: "/dashboard",
    selector: '[data-tour="widget-link"]',
    title: "Tu enlace de reservas",
    description:
      "Este es el enlace que verán tus clientes. Cuando termines la configuración, cópialo y compártelo en redes, WhatsApp o tu web.",
  },
  {
    path: "/dashboard/resources",
    selector: '[data-tour="add-resource"]',
    title: "Paso 1 · Crea tus recursos",
    description:
      "Un recurso es lo que se reserva: una mesa, una pista, una sala… Indica cuántas personas caben (aforo) y un precio en euros si quieres cobrar. Déjalo vacío para que sea gratis.",
  },
  {
    path: "/dashboard/hours",
    selector: '[data-tour="add-hours"]',
    title: "Paso 2 · Define tu horario",
    description:
      "Añade un tramo por día, por ejemplo lunes de 18:00 a 23:00. ¿Turno partido? Añade dos tramos el mismo día. Sin horario, tus clientes no verán huecos disponibles.",
  },
  {
    path: "/dashboard/hours",
    selector: '[data-tour="closures"]',
    title: "Cierres puntuales",
    description:
      "¿Festivo, evento privado o vacaciones? Bloquea el día entero aquí y ese día no se aceptarán reservas.",
  },
  {
    path: "/dashboard/bookings",
    selector: '[data-tour="bookings-day"]',
    title: "Tus reservas, día a día",
    description:
      "Consulta quién viene cada día y navega con Hoy, ← y →. Si cancelas una reserva, el cliente recibe un email automáticamente.",
  },
  {
    path: "/dashboard/settings",
    selector: '[data-tour="branding"]',
    title: "Dale tu toque",
    description:
      "Sube tu logo, elige tu color de marca y escribe un mensaje de bienvenida. Más abajo tienes una vista previa de cómo lo verán tus clientes.",
  },
  {
    path: "/dashboard/settings",
    selector: '[data-tour="embed"]',
    title: "Paso 3 · ¡Comparte y a recibir reservas!",
    description:
      "Copia este código para incrustar el widget en tu web, o comparte el enlace directo. Eso es todo — puedes repetir esta guía cuando quieras desde el botón «Guía» de arriba.",
  },
];

let activeDriver: Driver | null = null;

function finishTour() {
  localStorage.setItem(DONE_KEY, "1");
  sessionStorage.removeItem(STEP_KEY);
}

/** Run the tour starting at `index`, assuming its element is on the current page. */
function drive(index: number, router: Router) {
  activeDriver?.destroy();
  // Set while we tear down the overlay to navigate, so onDestroyed doesn't
  // mistake the page change for the user closing the tour.
  let navigating = false;

  const goTo = (next: number) => {
    if (next < 0) return;
    if (next >= STEPS.length) {
      d.destroy();
      return;
    }
    if (STEPS[next].path !== STEPS[d.getActiveIndex() ?? 0].path) {
      navigating = true;
      sessionStorage.setItem(STEP_KEY, String(next));
      d.destroy();
      router.push(STEPS[next].path);
      return;
    }
    d.moveTo(next);
  };

  const d = driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente →",
    prevBtnText: "← Anterior",
    doneBtnText: "¡Listo!",
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 16,
    popoverClass: "booking-tour",
    steps: STEPS.map((s) => ({
      element: s.selector,
      popover: { title: s.title, description: s.description },
    })),
    onNextClick: () => goTo((d.getActiveIndex() ?? 0) + 1),
    onPrevClick: () => goTo((d.getActiveIndex() ?? 0) - 1),
    onDestroyed: () => {
      activeDriver = null;
      if (!navigating) finishTour();
    },
  });

  activeDriver = d;
  d.drive(index);
}

/** Start (or restart) the tour at `index`, navigating to its page first if needed. */
function startTour(index: number, pathname: string, router: Router) {
  const step = STEPS[index] ?? STEPS[0];
  if (step.path !== pathname) {
    sessionStorage.setItem(STEP_KEY, String(index));
    router.push(step.path);
    return;
  }
  drive(index, router);
}

/**
 * Mount once in the dashboard layout. Auto-starts the tour on the first visit
 * and resumes a cross-page tour after each navigation.
 */
export function DashboardTour() {
  const pathname = usePathname();
  const router = useRouter();
  const autoStarted = useRef(false);

  useEffect(() => {
    const pending = sessionStorage.getItem(STEP_KEY);
    if (pending !== null) {
      const index = parseInt(pending, 10);
      const step = STEPS[index];
      if (!step) {
        sessionStorage.removeItem(STEP_KEY);
        return;
      }
      // Pending step for another page: keep waiting until we land there.
      if (step.path !== pathname) return;
      sessionStorage.removeItem(STEP_KEY);
      const t = setTimeout(() => drive(index, router), 300);
      return () => clearTimeout(t);
    }

    if (!autoStarted.current && !localStorage.getItem(DONE_KEY) && pathname === "/dashboard") {
      autoStarted.current = true;
      const t = setTimeout(() => drive(0, router), 600);
      return () => clearTimeout(t);
    }
  }, [pathname, router]);

  return null;
}

/** Header button to (re)launch the tour from anywhere in the dashboard. */
export function TourButton() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => {
        localStorage.removeItem(DONE_KEY);
        startTour(0, pathname, router);
      }}
    >
      <SparkleIcon className="h-4 w-4" /> Guía
    </button>
  );
}

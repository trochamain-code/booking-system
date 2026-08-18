import EmbedAutoHeight from "./EmbedAutoHeight";

/**
 * Layout de todas las rutas del embed (/embed/[slug], /book, /pay, /confirmed).
 * Añade el reporte de altura para que el iframe de la web se ajuste solo.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <EmbedAutoHeight />
    </>
  );
}

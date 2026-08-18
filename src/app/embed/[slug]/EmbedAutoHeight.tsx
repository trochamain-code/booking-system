"use client";

import { useEffect } from "react";

/**
 * Publica la altura real del contenido del embed al documento padre (la web que
 * incrusta el iframe) para que ajuste su alto y no aparezca un scroll interno.
 * El padre escucha `hostia-embed-height`. Se emite al montar, con ResizeObserver
 * y con un intervalo de respaldo por si algún cambio de layout no lo dispara.
 */
export default function EmbedAutoHeight() {
  useEffect(() => {
    // Medimos el <main> (contenido real del embed). documentElement.scrollHeight
    // nunca baja del viewport, así que inflaría la altura; main.scrollHeight da el
    // alto justo del contenido. Nunca enviamos 0 (frame transitorio de layout).
    const target = document.querySelector("main") ?? document.body;
    const post = () => {
      const height = Math.ceil(
        Math.max(target.scrollHeight, target.getBoundingClientRect().height),
      );
      if (height > 0) {
        window.parent?.postMessage({ type: "hostia-embed-height", height: height + 8 }, "*");
      }
    };

    post();
    const ro = new ResizeObserver(post);
    ro.observe(target);
    window.addEventListener("load", post);
    const id = window.setInterval(post, 1000);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
      window.clearInterval(id);
    };
  }, []);

  return null;
}

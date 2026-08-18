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
    const post = () => {
      const height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0,
        ),
      );
      window.parent?.postMessage({ type: "hostia-embed-height", height }, "*");
    };

    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
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

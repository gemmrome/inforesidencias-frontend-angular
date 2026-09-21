/**
 * Eventos de negocio hacia GTM (dataLayer). Portado literal de
 * src/lib/analitica/eventos.ts. La guarda `typeof window === 'undefined'` cumple aquí
 * el mismo papel que en Next: durante el render en servidor (Angular SSR) no hay
 * `window`, y esta función no debe hacer nada — solo emite cuando se ejecuta ya
 * hidratado en el navegador.
 */

type ParametrosEvento = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Empuja un evento al dataLayer. No falla nunca si GTM no está cargado (preproducción). */
export function enviarEvento(evento: string, parametros: ParametrosEvento = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: evento, ...parametros });
}

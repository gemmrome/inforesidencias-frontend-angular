/**
 * Utilidades de metadatos que dependen de un LÍMITE, no del criterio de quien escribe.
 * Portado literal de src/lib/seo/meta.ts.
 *
 * Por qué existe (2026-08-06): dos meta descriptions llevaban meses pasadas de largo
 * porque se componen con datos vivos (nº de centros, precio medio, nombre de zona).
 * Aquí el límite deja de ser una convención y pasa a ser código.
 */

/** Google recorta por píxeles, no por caracteres; 155 es el consenso operativo. */
export const LIMITE_DESCRIPCION = 155;

/**
 * Compone "lo que identifica la página" + "lo que la vende", dejando fuera lo segundo
 * cuando no cabe entero. Preferible a recortar con "…" porque el resultado sigue siendo
 * una frase completa.
 */
export function descripcionConCola(base: string, cola: string): string {
  const b = base.trim().replace(/\s+/g, ' ');
  const c = cola.trim().replace(/\s+/g, ' ');
  if (b.length + 1 + c.length <= LIMITE_DESCRIPCION) return `${b} ${c}`;
  return descripcionMeta(b);
}

/**
 * Devuelve la descripción tal cual si cabe; si no, la recorta por la última palabra
 * completa y cierra con "…" — nunca a mitad de palabra.
 */
export function descripcionMeta(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (limpio.length <= LIMITE_DESCRIPCION) return limpio;

  const corte = limpio.slice(0, LIMITE_DESCRIPCION - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  const base = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte;
  return `${base.replace(/[\s,;:.]+$/, '')}…`;
}

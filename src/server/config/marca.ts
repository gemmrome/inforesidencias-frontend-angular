/**
 * Datos de la marca que son AFIRMACIONES PÚBLICAS. Portado literal de
 * src/lib/marca.ts — no llevaba `server-only` en el original (son constantes que
 * también consumía JSON-LD renderizado en servidor, pero el valor en sí no es secreto);
 * se mantiene aquí junto al resto de configuración de negocio por cohesión, y también
 * se re-exporta desde `shared` si algún componente cliente necesitara mostrarlo (hoy
 * ninguno lo hace: el "+N años" se pinta en el servidor, igual que en el original).
 *
 * Año desde el que Inforesidencias ayuda a familias a buscar centro: **2000**, dato de
 * negocio fijado por PM el 2026-08-20 (no se deduce ni se calcula). Ver la cabecera
 * completa del fichero original para la corrección documentada del mismo día (2007 →
 * 2000) y las tres fuentes que lo confirman.
 */
export const ANIO_INICIO_AYUDA = 2000;

/**
 * Años completos ayudando a familias, contados hasta la fecha que se pase. NO lee la
 * fecha de la petición a propósito: la convención del proyecto es derivar el año de la
 * fecha de la sync del índice (`metaIndice().generado`), para que dos visitas a la
 * misma respuesta cacheada nunca den cifras distintas.
 */
export function anosAyudando(hasta: Date | string | number): number {
  return new Date(hasta).getFullYear() - ANIO_INICIO_AYUDA;
}

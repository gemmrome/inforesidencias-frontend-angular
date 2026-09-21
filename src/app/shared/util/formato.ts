/**
 * Números enteros con separador de miles SIEMPRE a partir de 4 cifras ("9.220").
 * CLDR español no agrupa los números de 4 dígitos (9220), pero la convención de
 * la marca y de producción sí ("1.750€/mes") — se fuerza el punto.
 *
 * Portado literalmente de src/lib/formato.ts (Next.js). Función pura: no depende de
 * Angular ni del servidor, se puede usar igual en navegador y en SSR.
 */
export function numES(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

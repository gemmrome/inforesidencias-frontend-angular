import type { DocIndice, FiltroIndice } from '../indice/tipos';

/**
 * Filtros de detalle del listado (docs/08 §6.2, patrón Baymard). Portado de
 * src/lib/buscador/filtros.ts.
 *
 * En el original este fichero llevaba `import "server-only"` porque solo lo usaban
 * Server Components; su cuerpo, sin embargo, es puro (no toca fs ni process.env), así
 * que aquí vive en `shared` y lo puede usar tanto el servidor (Express, al construir la
 * respuesta de `/api/v1/centros/buscar`) como un componente Angular en el navegador (para
 * componer enlaces de filtro sin ida y vuelta al servidor).
 *
 * Se aplican por **query params y enlaces**, no por estado oculto: funcionan sin JS,
 * son compartibles y el botón atrás funciona.
 */

/** Facetas verificables del índice (RP-02), con etiqueta corta para los chips. */
export const FACETAS_FILTRO: { clave: string; etiqueta: string }[] = [
  { clave: 'unidad-demencia', etiqueta: 'Unidad de demencia' },
  { clave: 'sin-sujeciones', etiqueta: 'Sin sujeciones' },
  { clave: 'concertada', etiqueta: 'Plazas concertadas' },
  { clave: 'medico-propio', etiqueta: 'Médico propio' },
  { clave: 'enfermeria-propia', etiqueta: 'Enfermería propia' },
  { clave: 'silla-ruedas', etiqueta: 'Adaptada a silla de ruedas' },
  { clave: 'encamados', etiqueta: 'Admite encamados' },
  { clave: 'acreditada-dependencia', etiqueta: 'Acreditada ley dependencia' },
  { clave: 'certificado-calidad', etiqueta: 'Certificado de calidad' },
];

export interface FiltrosListado {
  facetas: string[];
  /** Presupuesto mensual mínimo (€/mes). */
  precioMin?: number;
  /** Presupuesto mensual máximo (€/mes). */
  precioMax?: number;
}

/** Redondeo a múltiplos de 50 € para que los topes de la URL sean estables y legibles. */
const aPaso = (n: number) => Math.round(n / 50) * 50;

/** Lee los filtros de los query params, ignorando valores desconocidos. */
export function leerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosListado {
  const crudo = sp['f'];
  const lista = (Array.isArray(crudo) ? crudo.join(',') : (crudo ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const validas = FACETAS_FILTRO.map((f) => f.clave);
  const facetas = [...new Set(lista.filter((f) => validas.includes(f)))];

  const num = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) && n >= 100 && n <= 20000 ? aPaso(n) : undefined;
  };
  let precioMin = num(sp['precioMin']);
  let precioMax = num(sp['precioMax']);
  // Rango invertido: se corrige en vez de devolver 0 resultados.
  if (precioMin !== undefined && precioMax !== undefined && precioMin > precioMax) {
    [precioMin, precioMax] = [precioMax, precioMin];
  }

  return {
    facetas,
    ...(precioMin !== undefined && { precioMin }),
    ...(precioMax !== undefined && { precioMax }),
  };
}

export function hayFiltros(f: FiltrosListado): boolean {
  return f.facetas.length > 0 || f.precioMin !== undefined || f.precioMax !== undefined;
}

/** Filtros del listado → filtro del índice. */
export function aFiltroIndice(f: FiltrosListado): Pick<FiltroIndice, 'facetas' | 'precioMin' | 'precioMax'> {
  return {
    ...(f.facetas.length > 0 && { facetas: f.facetas }),
    ...(f.precioMin !== undefined && { precioMin: f.precioMin }),
    ...(f.precioMax !== undefined && { precioMax: f.precioMax }),
  };
}

/** Query string de un conjunto de filtros ("" si no hay ninguno). */
export function aQuery(f: FiltrosListado): string {
  const p = new URLSearchParams();
  if (f.facetas.length) p.set('f', f.facetas.join(','));
  if (f.precioMin !== undefined) p.set('precioMin', String(f.precioMin));
  if (f.precioMax !== undefined) p.set('precioMax', String(f.precioMax));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Enlace que activa/desactiva una faceta manteniendo el resto (toggle). */
export function alternarFaceta(base: string, f: FiltrosListado, clave: string): string {
  const activa = f.facetas.includes(clave);
  const facetas = activa ? f.facetas.filter((x) => x !== clave) : [...f.facetas, clave];
  return base + aQuery({ ...f, facetas });
}

/** Enlace que quita el filtro de presupuesto conservando el resto. */
export function quitarPrecio(base: string, f: FiltrosListado): string {
  return base + aQuery({ facetas: f.facetas });
}

/**
 * Histograma de precios de la zona (patrón Booking): cuántos centros hay en cada tramo.
 */
export function histogramaPrecios(
  precios: number[],
  tramos = 24,
): { min: number; max: number; barras: { desde: number; hasta: number; n: number }[] } | null {
  const ps = precios.filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
  if (ps.length < 5) return null; // muestra insuficiente: no se dibuja nada
  const min = aPaso(ps[0]);
  const max = aPaso(ps[ps.length - 1]);
  if (max <= min) return null;
  const ancho = (max - min) / tramos;
  const barras = Array.from({ length: tramos }, (_, i) => {
    const desde = min + i * ancho;
    const hasta = desde + ancho;
    const n = ps.filter((p) => p >= desde && (i === tramos - 1 ? p <= hasta : p < hasta)).length;
    return { desde: Math.round(desde), hasta: Math.round(hasta), n };
  });
  return { min, max, barras };
}

/** Cuántos centros quedarían si se añade cada faceta al filtro actual. */
export function contarPorFaceta(centros: DocIndice[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const { clave } of FACETAS_FILTRO) r[clave] = 0;
  for (const c of centros) {
    if (!c.facetas) continue;
    for (const f of c.facetas) if (f in r) r[f]++;
  }
  return r;
}

export interface DatosPanel {
  cuenta: Record<string, number>;
  totalConPrecio: number;
  histograma: ReturnType<typeof histogramaPrecios>;
}

/** Agregados del panel de filtros, calculados UNA vez por petición. */
export function datosPanel(candidatos: DocIndice[]): DatosPanel {
  const precios: number[] = [];
  for (const c of candidatos) if (c.precioDesde !== null) precios.push(c.precioDesde);
  return {
    cuenta: contarPorFaceta(candidatos),
    totalConPrecio: precios.length,
    histograma: histogramaPrecios(precios),
  };
}

import '../server-only';

import { comidaActiva, getFotosComida, getMenusSemanales, getSeccionCocina } from '../api/comida/client';
import type { FotoDiariaRow, MenuSemanalRow, SeccionResidenciaRow } from '../api/comida/types';
import { ES_PRODUCCION } from '../config/entorno';
import type { ComidaCentro, FotoPlato, MenuSemanal, MomentoComida } from '../../app/shared/dominio/comida.model';
import { residenciaDeCentro } from './comida-correlacion';

/**
 * Capa anticorrupción del segundo origen. Portado de src/lib/adapter/comida.ts.
 *
 * DIFERENCIA CON EL ORIGINAL: `comidaDeCentro` usaba `"use cache"` + `cacheLife("hours")`
 * + `cacheTag(...)` de Next.js Cache Components. Angular/Express no tiene ese mecanismo;
 * se sustituye por una caché en memoria de proceso con el mismo criterio (horas, no
 * días — el origen publica a diario) y la misma separación deliberada entre la función
 * SIN caché (`leerComidaDeCentro`, la que se prueba) y el envoltorio cacheado
 * (`comidaDeCentro`, la que consume la ruta de la ficha).
 */

export const MAX_PLATOS = 6;
export const MAX_COCINA = 2;
export const MAX_MENUS = 2;

function momento(valor: string | null): MomentoComida | undefined {
  return valor === 'desayuno' || valor === 'comida' || valor === 'cena' ? valor : undefined;
}

/** `2026-07-07T14:24:20.962795+00:00` → `2026-07-07`. Sin `Date`, para no arrastrar la
 *  zona horaria del servidor a una fecha que el centro escribió en la suya. */
function soloFecha(iso: string): string {
  return iso.slice(0, 10);
}

/** El texto de un plato solo se publica si lo ha revisado el centro (PM, 2026-08-14). */
function textoRevisado(f: FotoDiariaRow): string | undefined {
  const revisado = f.user_corrected_description?.trim() || f.description?.trim();
  return revisado || undefined;
}

export function toFotoPlato(f: FotoDiariaRow): FotoPlato {
  return {
    id: f.id,
    url: f.image_url,
    miniatura: f.thumbnail_url ?? undefined,
    momento: momento(f.meal_type),
    fecha: soloFecha(f.taken_at),
    texto: textoRevisado(f),
  };
}

export function toMenuSemanal(m: MenuSemanalRow): MenuSemanal | null {
  if (!m.pdf_url) return null;
  return {
    id: m.id,
    pdf: m.pdf_url,
    desde: m.valid_from ?? undefined,
    hasta: m.valid_to ?? undefined,
  };
}

export function toFotosCocina(s: SeccionResidenciaRow | null, limite: number): string[] {
  const rutas = s?.content?.photoPaths;
  if (!Array.isArray(rutas)) return [];
  return rutas.filter((r): r is string => typeof r === 'string' && r.length > 0).slice(0, limite);
}

export function toComidaCentro(
  fotos: FotoDiariaRow[],
  menus: MenuSemanalRow[],
  cocina: SeccionResidenciaRow | null,
): ComidaCentro {
  const platos = fotos.map(toFotoPlato);
  return {
    platos,
    cocina: toFotosCocina(cocina, MAX_COCINA),
    menus: menus.map(toMenuSemanal).filter((m): m is MenuSemanal => m !== null),
    ultimaPublicacion: platos.length
      ? platos.reduce((max, p) => (p.fecha > max ? p.fecha : max), platos[0].fecha)
      : undefined,
  };
}

/**
 * ¿Se puede pedir la comida de este centro? Tres condiciones LOCALES y síncronas: por
 * eso las otras ~9.250 fichas no hacen ni una petición.
 */
export function puedePublicarComida(centroId: number, esMiembro: boolean): string | null {
  if (!esMiembro) return null;
  const vinculo = residenciaDeCentro(centroId);
  if (!vinculo) return null;
  if (ES_PRODUCCION && vinculo.consentimiento !== 'otorgado') return null;
  return vinculo.residenciaId;
}

/**
 * La lógica, SIN caché — lo que se prueba. FALLO BLANDO: devuelve `null` y no lanza.
 */
export async function leerComidaDeCentro(centroId: number, esMiembro: boolean): Promise<ComidaCentro | null> {
  const residenciaId = puedePublicarComida(centroId, esMiembro);
  if (!residenciaId || !comidaActiva()) return null;

  const [fotos, menus, cocina] = await Promise.all([
    getFotosComida(residenciaId, MAX_PLATOS),
    getMenusSemanales(residenciaId, MAX_MENUS),
    getSeccionCocina(residenciaId),
  ]);
  return toComidaCentro(fotos, menus, cocina);
}

interface EntradaCache {
  expira: number;
  valor: ComidaCentro | null;
}
const CACHE_HORAS = 1000 * 60 * 60;
const cache = new Map<number, EntradaCache>();

/**
 * Lo que consume la ruta de la ficha, cacheado ~1h por centro. Clave HERMANA de la
 * caché del centro (`api/client.ts`), nunca compartida: un fallo de este origen externo
 * no debe envenenar la entrada cacheada de la ficha entera.
 */
export async function comidaDeCentro(centroId: number, esMiembro: boolean): Promise<ComidaCentro | null> {
  const enCache = cache.get(centroId);
  if (enCache && enCache.expira > Date.now()) return enCache.valor;
  const valor = await leerComidaDeCentro(centroId, esMiembro);
  cache.set(centroId, { expira: Date.now() + CACHE_HORAS, valor });
  return valor;
}

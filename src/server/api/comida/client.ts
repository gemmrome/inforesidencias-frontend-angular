import '../../server-only';

import type { FotoDiariaRow, MenuSemanalRow, SeccionResidenciaRow } from './types';

/**
 * Cliente del segundo origen: PostgREST de «Aquí se come bien» (Supabase autoalojado).
 * Portado LITERAL de src/lib/api/comida/client.ts. Solo servidor — la clave anónima NO
 * puede llegar al navegador. Ver la cabecera del fichero original para el historial de
 * seguridad completo (columnas que se filtraban por un rol anónimo demasiado abierto,
 * cerrado el 2026-08-21) — la lista blanca de columnas de abajo se mantiene igual de
 * estricta aunque el otro lado ya lo haya arreglado (defensa en profundidad).
 *
 * PRESUPUESTO DE TIEMPO, distinto del cliente de la API principal a propósito: aquí es
 * una SECCIÓN OPCIONAL dentro de una petición de usuario (TTFB ≤200 ms), así que 2,5 s y
 * CERO reintentos. Un origen colgado no puede sostener abierta la respuesta de una ficha.
 */

const TIEMPO_LIMITE_MS = 2_500;

function baseUrl(): string | undefined {
  return process.env['COMIDA_BASE_URL'] || undefined;
}

function anonKey(): string | undefined {
  return process.env['COMIDA_ANON_KEY'] || undefined;
}

/** Interruptor explícito. Ausente ⇒ apagado: el valor por defecto es el seguro. */
export function comidaActiva(): boolean {
  return process.env['COMIDA_ACTIVO'] === '1' && !!baseUrl() && !!anonKey();
}

/**
 * Una consulta a PostgREST. Devuelve `[]` ante cualquier problema —red, tiempo agotado,
 * 4xx/5xx, JSON ilegible— en vez de lanzar: para la ficha, «este centro no publica» y
 * «el origen está caído» son el mismo estado.
 */
async function consultar<T>(ruta: string): Promise<T[]> {
  const base = baseUrl();
  const clave = anonKey();
  if (!base || !clave) return [];
  try {
    const r = await fetch(`${base}/rest/v1/${ruta}`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
    if (!r.ok) return [];
    const datos: unknown = await r.json();
    return Array.isArray(datos) ? (datos as T[]) : [];
  } catch {
    return [];
  }
}

const COLUMNAS_FOTO =
  'id,meal_type,taken_at,image_url,thumbnail_url,description,user_corrected_description,food_name_es';

/** Fotos de comidas APROBADAS, de la más reciente a la más antigua. */
export async function getFotosComida(residenciaId: string, limite: number): Promise<FotoDiariaRow[]> {
  return consultar<FotoDiariaRow>(
    `fotos_diarias?select=${COLUMNAS_FOTO}` +
      `&residencia_id=eq.${residenciaId}&status=eq.approved` +
      `&order=taken_at.desc&limit=${limite}`,
  );
}

/** Menús semanales con PDF, del más reciente al más antiguo. */
export async function getMenusSemanales(residenciaId: string, limite: number): Promise<MenuSemanalRow[]> {
  return consultar<MenuSemanalRow>(
    `menus_semanales?select=id,pdf_url,file_url,valid_from,valid_to` +
      `&residencia_id=eq.${residenciaId}&pdf_url=not.is.null` +
      `&order=valid_from.desc&limit=${limite}`,
  );
}

/** La sección «cocina» de la residencia, si la tiene completada. */
export async function getSeccionCocina(residenciaId: string): Promise<SeccionResidenciaRow | null> {
  const filas = await consultar<SeccionResidenciaRow>(
    `secciones_residencia?select=section_type,content` +
      `&residencia_id=eq.${residenciaId}&section_type=eq.cocina&limit=1`,
  );
  return filas[0] ?? null;
}

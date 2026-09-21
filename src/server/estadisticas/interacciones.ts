import '../server-only';

/**
 * Interacciones de ficha que hay que DEVOLVER AL BACK-END, no solo medir (clics en "Ver
 * teléfono" / "Ver web"). Portado LITERAL de src/lib/estadisticas/interacciones.ts. Ver
 * la cabecera del fichero original para el porqué del puente `dry-run`/`real` y el
 * contrato pendiente `POST /v1/centros/{id}/interacciones`.
 */

const PUENTE_BASE = process.env['PUENTE_BASE_URL'] ?? 'https://www.inforesidencias.com';
const MODO = process.env['PUENTE_MODO'] ?? 'dry-run';
const UA = 'InforesidenciasClone/0.1 (estadistica de ficha; gestion@inforesidencias.com)';

export const ACCIONES_FICHA = ['telefono', 'web'] as const;
export type AccionFicha = (typeof ACCIONES_FICHA)[number];

export function esAccionFicha(v: string): v is AccionFicha {
  return (ACCIONES_FICHA as readonly string[]).includes(v);
}

export interface ResultadoInteraccion {
  ok: boolean;
  modo: string;
}

export async function registrarInteraccionCentro(idCentro: number, accion: AccionFicha): Promise<ResultadoInteraccion> {
  if (MODO !== 'real') {
    console.log(`[estadistica dry-run] centro ${idCentro} · ${accion}`);
    return { ok: true, modo: 'dry-run' };
  }
  try {
    const res = await fetch(`${PUENTE_BASE}/centros/datos-ajax/${idCentro}/${accion}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5_000),
    });
    return { ok: res.ok, modo: 'real' };
  } catch {
    return { ok: false, modo: 'real' };
  }
}

import '../server-only';

/**
 * Puente de leads al monolito (docs/12: puente TEMPORAL; destino final POST /v1/leads).
 * Portado LITERAL de src/lib/leads/puente.ts.
 *
 * MODO: process.env.PUENTE_MODO
 *  - "dry-run" (por defecto): NO reenvía a producción — registra y devuelve éxito.
 *    Imprescindible en preproducción: un envío real crearía un lead FALSO que llegaría
 *    por email a un centro real.
 *  - "real": reenvía al monolito.
 */

const PUENTE_BASE = process.env['PUENTE_BASE_URL'] ?? 'https://www.inforesidencias.com';
const MODO = process.env['PUENTE_MODO'] ?? 'dry-run';
const UA = 'InforesidenciasClone/0.1 (puente de formularios; gestion@inforesidencias.com)';

export interface ResultadoPuente {
  ok: boolean;
  modo: string;
  mensaje: string;
}

async function reenviar(ruta: string, campos: Record<string, string>): Promise<ResultadoPuente> {
  if (MODO !== 'real') {
    // Sin datos personales en el log: solo forma del envío (docs/14).
    console.log(`[puente dry-run] POST ${ruta} · campos: ${Object.keys(campos).join(',')}`);
    return { ok: true, modo: 'dry-run', mensaje: 'Simulado (preproducción): no se ha enviado nada.' };
  }
  const res = await fetch(`${PUENTE_BASE}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams(campos).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const cuerpo = (await res.text()).trim();
  const ok = res.ok && (cuerpo === 'success' || ruta.includes('proactivo'));
  return { ok, modo: 'real', mensaje: ok ? 'Enviado.' : `Respuesta del monolito: ${res.status} ${cuerpo.slice(0, 120)}` };
}

export function enviarContactoCentro(idCentro: number, campos: Record<string, string>) {
  return reenviar(`/centros/contactar/${idCentro}`, campos);
}

export function enviarBusquedaProactiva(campos: Record<string, string>) {
  return reenviar(`/centros/buscador/proactivo/enviar-datos`, campos);
}

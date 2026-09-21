import '../server-only';

import type { CentroBeanAPI } from './types';

/**
 * Cliente de la API interna. Portado LITERAL de src/lib/api/client.ts — la lógica de
 * reintentos, tiempos límite y qué es transitorio no cambia nada al pasar de Next a
 * Express: sigue siendo `fetch` puro en Node. Solo se ejecuta en el servidor: las
 * credenciales jamás llegan al navegador.
 *
 * (El comentario original sobre "Cache Components" de Next.js ya no aplica: este
 * cliente cachea ahora con una caché en memoria de proceso, ver `envolverConCache` más
 * abajo, con la misma intención — no golpear la API en cada petición — pero sin ese
 * mecanismo específico de Next).
 */

const REVALIDATE_SECONDS = 3600;

/**
 * REINTENTOS — por qué existen (medido el 2026-08-10). Un solo 500 transitorio de la
 * API no puede abortar una sincronización de ~9.000 fichas. Los números están elegidos
 * para el peor caso de una sync grande, no para una petición suelta: 3 intentos con
 * esperas de 400 ms y 800 ms suman como mucho ~1,2 s extra por ficha que falle.
 */
const INTENTOS_MAX = 3;
const ESPERA_BASE_MS = 400;
/** Un `fetch` colgado no falla nunca: bloquearía la sync de forma indefinida. */
const TIEMPO_LIMITE_MS = 15_000;
/** Tope a `Retry-After`: la API podría pedir minutos y la sync no puede esperarlos. */
const ESPERA_MAXIMA_MS = 10_000;

/**
 * Se leen dentro de la función y no en el módulo a propósito: en el servidor se
 * inyectan por systemd/el gestor de procesos y en las pruebas se sustituyen; una
 * constante de módulo congelaría el valor en el primer `import`.
 */
function baseUrl(): string {
  return process.env['API_IR_BASE_URL'] ?? 'https://api.inforesidencias.com/api';
}

function authHeader(): string {
  const usuario = process.env['API_IR_USER'] ?? 'Infoelder';
  const contrasenya = process.env['API_KEY_API_IR'];
  if (!contrasenya) {
    throw new Error('Falta API_KEY_API_IR en el entorno (ver .env.example; nunca en el repo).');
  }
  return 'Basic ' + Buffer.from(`${usuario}:${contrasenya}`).toString('base64');
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Qué merece otro intento y qué no. Sí: 5xx, 429, 408. NO: el resto de 4xx (un 401 es
 * una clave mala y un 400 una petición mal formada: reintentarlos no los arregla).
 */
function esTransitorio(estado: number): boolean {
  return estado >= 500 || estado === 429 || estado === 408;
}

/**
 * Espera antes del siguiente intento, con una parte aleatoria para no reintentar EN
 * BLOQUE si la API devuelve 500 a muchas peticiones a la vez.
 */
function esperaMs(intento: number, cabeceraRetryAfter: string | null): number {
  const pedidaPorLaApi = Number(cabeceraRetryAfter);
  if (Number.isFinite(pedidaPorLaApi) && pedidaPorLaApi > 0) {
    return Math.min(pedidaPorLaApi * 1000, ESPERA_MAXIMA_MS);
  }
  const base = ESPERA_BASE_MS * intento;
  return Math.min(base + Math.random() * base * 0.4, ESPERA_MAXIMA_MS);
}

interface EntradaCache<T> {
  expira: number;
  valor: T;
}
const cacheGet = new Map<string, EntradaCache<unknown>>();

async function apiGet<T>(path: string): Promise<T | null> {
  const enCache = cacheGet.get(path);
  if (enCache && enCache.expira > Date.now()) return enCache.valor as T;

  let ultimoMotivo = '';

  for (let intento = 1; intento <= INTENTOS_MAX; intento++) {
    let esperaTrasFallo: number | null = null;

    try {
      const res = await fetch(`${baseUrl()}${path}`, {
        headers: { Authorization: authHeader() },
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });

      // 404 no es un fallo: en esta API significa "no existe". No se reintenta.
      if (res.status === 404) return null;
      if (res.ok) {
        const valor = (await res.json()) as T;
        cacheGet.set(path, { expira: Date.now() + REVALIDATE_SECONDS * 1000, valor });
        return valor;
      }

      if (!esTransitorio(res.status)) {
        throw new Error(`API ${path} respondió ${res.status}`);
      }
      ultimoMotivo = `HTTP ${res.status}`;
      esperaTrasFallo = esperaMs(intento, res.headers?.get?.('retry-after') ?? null);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(`API ${path} respondió `)) throw e;
      ultimoMotivo = e instanceof Error ? e.message : String(e);
      esperaTrasFallo = esperaMs(intento, null);
    }

    if (intento === INTENTOS_MAX) break;
    console.warn(`API ${path}: ${ultimoMotivo} — intento ${intento}/${INTENTOS_MAX}, reintentando.`);
    await dormir(esperaTrasFallo);
  }

  // Fallo persistente: se lanza a propósito. Publicar la ficha vacía sería peor que un 500.
  throw new Error(`API ${path} falló tras ${INTENTOS_MAX} intentos (último: ${ultimoMotivo})`);
}

export async function getCentroRaw(id: number): Promise<CentroBeanAPI | null> {
  return apiGet<CentroBeanAPI>(`/centro/${id}`);
}

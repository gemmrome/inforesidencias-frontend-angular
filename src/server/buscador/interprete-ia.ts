import '../server-only';

import { sugerirZonas } from '../indice/sugerencias';
import { FACETAS_FILTRO } from '../../app/shared/buscador/filtros';
import { interpretarConsulta, esUtil, TIPOLOGIAS_VALIDAS, type ConsultaInterpretada } from './parser';

/**
 * CAPA 2 del buscador — intérprete de lenguaje natural con Cloudflare Workers AI.
 * Portado LITERAL de src/lib/buscador/interprete-ia.ts. Reglas heredadas del proyecto
 * chat-bot ("LLM is a TOOL, not a CONTROLLER"):
 *  1. Solo se invoca si la capa 1 (reglas) no ha sacado nada y la consulta parece
 *     lenguaje natural.
 *  2. El modelo NO decide: propone valores que se VALIDAN contra nuestras listas y
 *     contra el índice. Lo que no valida, se descarta.
 *  3. Degradación elegante: sin configuración, con fallo de red o con timeout, se
 *     devuelve la interpretación por reglas. El buscador NUNCA depende de la IA.
 *  4. Caché en memoria por consulta normalizada.
 */

const MODELO = process.env['CF_AI_MODELO'] ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const TIEMPO_MAXIMO_MS = 3500;

const PROMPT = `Eres un extractor de filtros de búsqueda para inforesidencias.com, \
directorio español de residencias y servicios para personas mayores.

Devuelve SOLO un JSON válido, sin markdown ni explicaciones, con esta forma:
{"tipologia": string|null, "lugar": string|null, "facetas": string[], "precioMax": number|null}

REGLAS:
- "tipologia" solo puede ser uno de: TIPOLOGIAS
- "facetas" solo puede contener valores de: FACETAS
- "lugar" es el municipio, comarca o provincia mencionado, tal cual, sin inventar
- "precioMax" es el presupuesto mensual máximo en euros (número), o null
- Si un dato no aparece claramente en el texto, usa null o lista vacía. NO inventes.`;

interface RespuestaModelo {
  tipologia?: string | null;
  lugar?: string | null;
  facetas?: string[] | null;
  precioMax?: number | null;
}

const cache = new Map<string, ConsultaInterpretada>();
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** ¿Merece la pena preguntar al modelo? Frases, no términos sueltos. */
function pareceLenguajeNatural(consulta: string): boolean {
  const palabras = consulta.trim().split(/\s+/);
  return palabras.length >= 4;
}

async function llamarWorkersAI(consulta: string): Promise<RespuestaModelo | null> {
  const cuenta = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const token = process.env['CLOUDFLARE_API_TOKEN'];
  if (!cuenta || !token) return null; // sin credenciales → capa 1 (no es un error)

  const sistema = PROMPT.replace('TIPOLOGIAS', TIPOLOGIAS_VALIDAS.join(', ')).replace(
    'FACETAS',
    FACETAS_FILTRO.map((f) => f.clave).join(', '),
  );

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/ai/run/${MODELO}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: consulta },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
      signal: control.signal,
    });
    if (!res.ok) return null;
    const datos = (await res.json()) as { result?: { response?: string } };
    const texto: string = datos?.result?.response ?? '';
    const json = texto.match(/\{[\s\S]*\}/)?.[0];
    return json ? (JSON.parse(json) as RespuestaModelo) : null;
  } catch {
    return null; // timeout, red, JSON inválido → degradación
  } finally {
    clearTimeout(reloj);
  }
}

/** Interpreta la consulta: reglas primero, IA solo si hace falta. Nunca lanza. */
export async function interpretar(consulta: string): Promise<ConsultaInterpretada> {
  const porReglas = interpretarConsulta(consulta);
  if (esUtil(porReglas) || !pareceLenguajeNatural(consulta)) return porReglas;

  const clave = norm(consulta);
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const bruto = await llamarWorkersAI(consulta);
  if (!bruto) return porReglas;

  const facetasValidas = new Set(FACETAS_FILTRO.map((f) => f.clave));
  const facetas = (bruto.facetas ?? []).filter((f) => facetasValidas.has(f));

  const tipologia = bruto.tipologia && TIPOLOGIAS_VALIDAS.includes(bruto.tipologia) ? bruto.tipologia : undefined;

  let geo: string | undefined;
  let zonaNombre: string | undefined;
  if (bruto.lugar) {
    const [zona] = sugerirZonas(bruto.lugar, 1);
    if (zona) {
      geo = zona.segmentos;
      zonaNombre = zona.nombre;
    }
  }

  const precio = Number(bruto.precioMax);
  const precioMax = Number.isFinite(precio) && precio >= 300 && precio <= 10000 ? precio : undefined;

  if (!geo && facetas.length === 0 && precioMax === undefined) return porReglas;

  const params = new URLSearchParams();
  if (facetas.length) params.set('f', facetas.join(','));
  if (precioMax !== undefined) params.set('precioMax', String(precioMax));
  const q = params.toString();

  const resultado: ConsultaInterpretada = {
    ...(tipologia && { tipologia }),
    ...(geo && { geo }),
    ...(zonaNombre && { zonaNombre }),
    facetas,
    ...(precioMax !== undefined && { precioMax }),
    resto: porReglas.resto,
    url: `/centros/buscador/${tipologia ?? 'residencias'}${geo ? `/${geo}` : ''}${q ? `?${q}` : ''}`,
    capa: 'ia',
  };

  if (cache.size > 500) cache.clear();
  cache.set(clave, resultado);
  return resultado;
}

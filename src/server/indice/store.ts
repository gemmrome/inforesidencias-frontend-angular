import '../server-only';

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';

import type { DocIndice, FiltroIndice, MetaIndice } from '../../app/shared/indice/tipos';

/**
 * Índice de centros en memoria (ADR-0003, opción D: embebido en el propio servidor).
 * Portado de src/lib/indice/store.ts. Se alimenta del fichero que genera
 * `scripts/sync-indice.mjs` (el mismo script del proyecto original, sin cambios: no
 * depende de Next en ningún punto); si el fichero cambia en disco, el índice se
 * reconstruye en la siguiente petición. Las páginas y rutas consumen
 * `buscar()`/`listar()`; cambiar MiniSearch por otro motor no las toca.
 *
 * `DocIndice`/`FiltroIndice`/`MetaIndice` viven en `src/app/shared/indice/tipos.ts`
 * porque son la forma de datos que también recibe el CLIENTE (vía `/api/v1/...`); este
 * fichero es el único que sabe CONSTRUIR y CONSULTAR el índice — eso sí, server-only.
 */

const DATA_DIR = join(process.cwd(), 'data');
const FICHERO_DOCS = join(DATA_DIR, 'indice-centros.json');
const FICHERO_META = join(DATA_DIR, 'indice-meta.json');

interface Cache {
  mtimeMs: number;
  docs: DocIndice[];
  meta: MetaIndice;
  mini: MiniSearch<DocIndice>;
}

let cache: Cache | null = null;

function cargar(): Cache {
  const mtimeMs = statSync(FICHERO_DOCS).mtimeMs;
  if (cache && cache.mtimeMs === mtimeMs) return cache;

  const docs = JSON.parse(readFileSync(FICHERO_DOCS, 'utf8')) as DocIndice[];
  const meta = JSON.parse(readFileSync(FICHERO_META, 'utf8')) as MetaIndice;
  // Tokenización sin acentos a ambos lados: sin esto, la errata "cornela" no encuentra
  // "Cornellá" (la distancia fuzzy se mide sobre el término CON acento y no llega).
  const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const mini = new MiniSearch<DocIndice>({
    fields: ['nombre', 'poblacion', 'comarca', 'direccion', 'provincia', 'codigoPostal'],
    storeFields: [
      'centroId', 'codTipologia', 'tipologia', 'nombre', 'comunidad', 'provincia',
      'comarca', 'poblacion', 'codigoPostal', 'direccion', 'plazas', 'precioDesde',
      'ratioPersonal', 'transparencia', 'url', 'imagen', 'provinciasAlcance', 'facetas',
      'fechaActualizacion',
    ],
    processTerm: sinAcentos,
    searchOptions: {
      fuzzy: 0.2, prefix: true, boost: { nombre: 3, poblacion: 2 }, processTerm: sinAcentos,
    },
  });
  mini.addAll(docs);
  cache = { mtimeMs, docs, meta, mini };
  return cache;
}

type DocFiltrable = Pick<
  DocIndice,
  'codTipologia' | 'provinciasAlcance' | 'poblacion' | 'comarca' | 'facetas' | 'precioDesde' | 'plazas'
>;

/**
 * Regla ÚNICA de filtrado por facetas/precio/plazas. En el original estaba
 * reimplementada a mano en la página del buscador y divergía; se exporta para que solo
 * exista aquí (docs/23 §B-6).
 */
export function pasaFiltro(d: DocFiltrable, f: FiltroIndice): boolean {
  if (f.codTipologia !== undefined && d.codTipologia !== f.codTipologia) return false;
  if (f.provincia && !d.provinciasAlcance.includes(f.provincia)) return false;
  if (f.poblacion && d.poblacion !== f.poblacion) return false;
  if (f.comarca && d.comarca !== f.comarca) return false;
  if (f.facetas?.length && !f.facetas.every((x) => d.facetas?.includes(x))) return false;
  // Sin precio publicado no se puede afirmar que cumpla el rango → fuera (honestidad).
  if (f.precioMin !== undefined && (d.precioDesde === null || d.precioDesde < f.precioMin)) return false;
  if (f.precioMax !== undefined && (d.precioDesde === null || d.precioDesde > f.precioMax)) return false;
  if (f.plazasMin !== undefined && (d.plazas === null || d.plazas < f.plazasMin)) return false;
  return true;
}

/** Búsqueda de texto libre (typo-tolerante) con filtros opcionales. */
export function buscar(consulta: string, filtro: FiltroIndice = {}, limite = 50): DocIndice[] {
  const { mini } = cargar();
  return mini
    .search(consulta, { filter: (r) => pasaFiltro(r as unknown as DocFiltrable, filtro) })
    .slice(0, limite) as unknown as DocIndice[];
}

/** Listado sin consulta de texto (páginas geográficas): todos los que pasan el filtro. */
export function listar(filtro: FiltroIndice = {}): DocIndice[] {
  return cargar().docs.filter((d) => pasaFiltro(d, filtro));
}

/** Recuentos por tipología para un filtro. */
export function contarPorTipologia(filtro: Omit<FiltroIndice, 'codTipologia'> = {}): Record<string, number> {
  const r: Record<string, number> = {};
  for (const d of listar(filtro)) r[d.tipologia] = (r[d.tipologia] || 0) + 1;
  return r;
}

/** Metadatos de frescura (para observabilidad y la alerta de sync). */
export function metaIndice(): MetaIndice {
  return cargar().meta;
}

export interface RutaCanonicaFicha {
  id: number;
  tipoRuta: string;
  slug: string;
}

export const rutasCanonicasDeFicha = (): Map<number, RutaCanonicaFicha[]> => mapaCanonicas();

const mapaCanonicas = memoPorVersion(function mapaCanonicas(): Map<number, RutaCanonicaFicha[]> {
  const mapa = new Map<number, RutaCanonicaFicha[]>();
  for (const d of cargar().docs) {
    if (!d.url) continue;
    const partes = new URL(d.url).pathname.split('/'); // ["", "centros", tipo, id, slug]
    if (partes.length < 5) continue;
    const id = Number(partes[3]);
    if (!Number.isInteger(id)) continue;
    const lista = mapa.get(id) ?? [];
    lista.push({ id, tipoRuta: partes[2], slug: partes[4] });
    mapa.set(id, lista);
  }
  return mapa;
}, () => 'unica');

/** Versión del índice cargado en memoria: cambia con cada sync. */
export function versionIndice(): string {
  return cargar().meta.generado;
}

/**
 * Memoización de funciones PURAS derivadas del índice, a nivel de proceso, con la
 * versión del índice como clave de invalidación. Portado literal de
 * src/lib/indice/store.ts — solo cambia el motivo de por qué NO se usa `"use cache"` de
 * Next: aquí ya no existe ese mecanismo, así que esta memoización manual es la única
 * capa de caché (antes era una alternativa deliberada a `"use cache"` para los arrays
 * grandes; ahora es, sencillamente, la caché).
 */
const TOPE_ENTRADAS = 4_000;

export function memoPorVersion<A extends unknown[], R>(
  fn: (...args: A) => R,
  clave: (...args: A) => string = (...a) => JSON.stringify(a),
): (...args: A) => R {
  let version: string | null = null;
  let mapa = new Map<string, R>();
  return (...args: A): R => {
    const v = versionIndice();
    if (v !== version || mapa.size > TOPE_ENTRADAS) {
      version = v;
      mapa = new Map();
    }
    const k = clave(...args);
    const previo = mapa.get(k);
    if (previo !== undefined || mapa.has(k)) return previo as R;
    const r = fn(...args);
    mapa.set(k, r);
    return r;
  };
}

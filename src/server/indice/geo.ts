import '../server-only';

import { listar, memoPorVersion, metaIndice } from './store';
import { TIPOLOGIAS_RUTA } from '../../app/shared/indice/tipos';
import type { DocIndice, GeoRef, Subzona } from '../../app/shared/indice/tipos';

/**
 * Geografía del buscador. Portado LITERAL de src/lib/indice/geo.ts. `TIPOLOGIAS_RUTA`
 * se movió a `shared/indice/tipos.ts` porque también la usan componentes de cliente
 * (menús de tipología); todo lo demás de este fichero es server-only: construye el
 * árbol geográfico a partir del índice en memoria.
 */

const memoSlug = new Map<string, string>();

export function slugGeo(nombre: string): string {
  const previo = memoSlug.get(nombre);
  if (previo !== undefined) return previo;
  const r = calcularSlugGeo(nombre);
  if (memoSlug.size < 50_000) memoSlug.set(nombre, r);
  return r;
}

function calcularSlugGeo(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùû]/g, 'u') // ü NO: en producción cae al separador (monfrag-e)
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface NodoProvincia {
  nombre: string;
  comarcas: Map<string, string>; // slug → nombre normalizado
  poblaciones: Map<string, string>;
}
interface NodoCcaa {
  nombre: string;
  provincias: Map<string, NodoProvincia>;
}
interface Arbol {
  version: string;
  ccaa: Map<string, NodoCcaa>;
}

let arbolCache: Arbol | null = null;

/** El nombre ganador de cada slug es el más frecuente entre los documentos. */
function nombreDominante(recuentos: Map<string, Map<string, number>>, slug: string): string {
  const variantes = recuentos.get(slug)!;
  return [...variantes.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function construirArbol(): Arbol {
  const version = metaIndice().generado;
  if (arbolCache && arbolCache.version === version) return arbolCache;

  const ccaa = new Map<string, NodoCcaa>();
  const variantes = new Map<string, Map<string, number>>();
  const cuenta = (clave: string, nombre: string) => {
    const m = variantes.get(clave) ?? new Map();
    m.set(nombre, (m.get(nombre) ?? 0) + 1);
    variantes.set(clave, m);
  };

  for (const d of listar()) {
    const sc = slugGeo(d.comunidad);
    const sp = slugGeo(d.provincia);
    cuenta(`c:${sc}`, d.comunidad);
    cuenta(`p:${sp}`, d.provincia);
    let nodoCcaa = ccaa.get(sc);
    if (!nodoCcaa) ccaa.set(sc, (nodoCcaa = { nombre: d.comunidad, provincias: new Map() }));
    let prov = nodoCcaa.provincias.get(sp);
    if (!prov) nodoCcaa.provincias.set(sp, (prov = { nombre: d.provincia, comarcas: new Map(), poblaciones: new Map() }));
    if (d.comarca) {
      const sk = slugGeo(d.comarca);
      cuenta(`k:${sp}:${sk}`, d.comarca);
      prov.comarcas.set(sk, d.comarca);
    }
    if (d.poblacion) {
      const so = slugGeo(d.poblacion);
      cuenta(`o:${sp}:${so}`, d.poblacion);
      prov.poblaciones.set(so, d.poblacion);
    }
  }
  for (const [sc, nodo] of ccaa) {
    nodo.nombre = nombreDominante(variantes, `c:${sc}`);
    for (const [sp, prov] of nodo.provincias) {
      prov.nombre = nombreDominante(variantes, `p:${sp}`);
      for (const sk of prov.comarcas.keys()) prov.comarcas.set(sk, nombreDominante(variantes, `k:${sp}:${sk}`));
      for (const so of prov.poblaciones.keys()) prov.poblaciones.set(so, nombreDominante(variantes, `o:${sp}:${so}`));
    }
  }
  arbolCache = { version, ccaa };
  return arbolCache;
}

/**
 * Resuelve los segmentos geográficos de la URL, ESCOPADO a la provincia (a diferencia
 * del monolito, cuyo lookup global falla con homónimos). En el nivel 3, comarca tiene
 * prioridad sobre población homónima.
 */
export function resolverGeo(segmentos: string[]): GeoRef | null {
  if (segmentos.length === 0) return { nivel: 'nacional' };
  const arbol = construirArbol();
  const nodoCcaa = arbol.ccaa.get(segmentos[0]);
  if (!nodoCcaa) return null;
  if (segmentos.length === 1) return { nivel: 'ccaa', comunidad: nodoCcaa.nombre };
  const prov = nodoCcaa.provincias.get(segmentos[1]);
  if (!prov) return null;
  if (segmentos.length === 2) return { nivel: 'provincia', comunidad: nodoCcaa.nombre, provincia: prov.nombre };
  if (segmentos.length > 3) return null;
  const comarca = prov.comarcas.get(segmentos[2]);
  if (comarca) return { nivel: 'comarca', comunidad: nodoCcaa.nombre, provincia: prov.nombre, comarca };
  const poblacion = prov.poblaciones.get(segmentos[2]);
  if (poblacion) return { nivel: 'poblacion', comunidad: nodoCcaa.nombre, provincia: prov.nombre, poblacion };
  return null;
}

function pasaGeo(d: DocIndice, ref: GeoRef): boolean {
  switch (ref.nivel) {
    case 'nacional':
      return true;
    case 'ccaa': {
      if (d.comunidad === ref.comunidad) return true;
      const provs = construirArbol().ccaa.get(slugGeo(ref.comunidad))?.provincias;
      return provs ? d.provinciasAlcance.some((p) => provs.has(slugGeo(p))) : false;
    }
    case 'provincia':
      return d.provinciasAlcance.some((p) => slugGeo(p) === slugGeo(ref.provincia));
    case 'comarca':
      return slugGeo(d.provincia) === slugGeo(ref.provincia) && slugGeo(d.comarca) === slugGeo(ref.comarca);
    case 'poblacion':
      return slugGeo(d.provincia) === slugGeo(ref.provincia) && slugGeo(d.poblacion) === slugGeo(ref.poblacion);
  }
}

/**
 * Criterios de ordenación de los listados: transparencia (por defecto) y
 * actualización. Ver la cabecera del fichero original para el porqué de haber retirado
 * "precio más bajo" y "nombre" (PM, 2026-08-14).
 */
export const COMPARADORES: Record<'transparencia' | 'actualizacion', (a: DocIndice, b: DocIndice) => number> = {
  transparencia: (a, b) =>
    (b.transparencia ?? -1) - (a.transparencia ?? -1) ||
    (a.precioDesde ?? Infinity) - (b.precioDesde ?? Infinity) ||
    a.nombre.localeCompare(b.nombre, 'es'),
  actualizacion: (a, b) =>
    (b.fechaActualizacion ?? '').localeCompare(a.fechaActualizacion ?? '') ||
    (b.transparencia ?? -1) - (a.transparencia ?? -1) ||
    a.nombre.localeCompare(b.nombre, 'es'),
};

/** ¿Se puede ordenar por fecha en ESTA zona? Umbral MAYORÍA, no "alguno" (ver cabecera
 *  del original: con cobertura escasa, el criterio degenera en ruido). */
export function sePuedeOrdenarPorFecha(docs: DocIndice[]): boolean {
  if (!docs.length) return false;
  return docs.filter((d) => d.fechaActualizacion).length * 2 >= docs.length;
}

/** Centros de una zona para una tipología (`cod: null` = todas). MEMOIZADA por versión
 *  del índice: era la función más cara del clon (docs/23 §B-2). */
export const centrosDeZona = memoPorVersion(
  function centrosDeZona(ref: GeoRef, cod: number | null, orden: 'transparencia' | 'actualizacion' = 'transparencia'): DocIndice[] {
    return listar(cod === null ? {} : { codTipologia: cod })
      .filter((d) => pasaGeo(d, ref))
      .sort(COMPARADORES[orden]);
  },
  (ref, cod, orden = 'transparencia') => `${cod}|${orden}|${claveGeo(ref)}`,
);

/** Clave estable y barata de una GeoRef (evita JSON.stringify en el camino caliente). */
export function claveGeoPublica(ref: GeoRef): string {
  return claveGeo(ref);
}

function claveGeo(ref: GeoRef): string {
  switch (ref.nivel) {
    case 'nacional':
      return 'n';
    case 'ccaa':
      return `c:${ref.comunidad}`;
    case 'provincia':
      return `p:${ref.comunidad}:${ref.provincia}`;
    case 'comarca':
      return `k:${ref.comunidad}:${ref.provincia}:${ref.comarca}`;
    case 'poblacion':
      return `o:${ref.comunidad}:${ref.provincia}:${ref.poblacion}`;
  }
}

/** Subzonas navegables con contador (CCAA → provincias → comarcas → poblaciones). */
export const subzonas = memoPorVersion(function subzonas(ref: GeoRef, cod: number | null): Subzona[] {
  const docs = centrosDeZona(ref, cod);
  const arbol = construirArbol();
  const recuento = new Map<string, Subzona>();
  const suma = (slug: string, nombre: string) => {
    const s = recuento.get(slug) ?? { slug, nombre, centros: 0 };
    s.centros++;
    recuento.set(slug, s);
  };
  for (const d of docs) {
    switch (ref.nivel) {
      case 'nacional':
        suma(slugGeo(d.comunidad), arbol.ccaa.get(slugGeo(d.comunidad))?.nombre ?? d.comunidad);
        break;
      case 'ccaa':
        for (const p of d.provinciasAlcance) {
          const sp = slugGeo(p);
          const nodo = arbol.ccaa.get(slugGeo(ref.comunidad))?.provincias.get(sp);
          if (nodo) suma(sp, nodo.nombre);
        }
        break;
      case 'provincia':
        if (d.comarca && slugGeo(d.provincia) === slugGeo(ref.provincia)) suma(slugGeo(d.comarca), d.comarca);
        break;
      case 'comarca':
        if (d.poblacion) suma(slugGeo(d.poblacion), d.poblacion);
        break;
      case 'poblacion':
        break;
    }
  }
  return [...recuento.values()].sort((a, b) => b.centros - a.centros || a.nombre.localeCompare(b.nombre, 'es'));
}, (ref, cod) => `${cod}|${claveGeo(ref)}`);

/** Ruta URL de una zona (sin tipología). */
export function rutaGeo(ref: GeoRef): string {
  switch (ref.nivel) {
    case 'nacional':
      return '';
    case 'ccaa':
      return `/${slugGeo(ref.comunidad)}`;
    case 'provincia':
      return `/${slugGeo(ref.comunidad)}/${slugGeo(ref.provincia)}`;
    case 'comarca':
      return `/${slugGeo(ref.comunidad)}/${slugGeo(ref.provincia)}/${slugGeo(ref.comarca)}`;
    case 'poblacion':
      return `/${slugGeo(ref.comunidad)}/${slugGeo(ref.provincia)}/${slugGeo(ref.poblacion)}`;
  }
}

/**
 * Referencia de una subzona a partir de su nombre. La jerarquía de la URL NO es la de
 * navegación (una población cuelga de la PROVINCIA, no de su comarca) — ver cabecera
 * del original para el bug de enlaces rotos que esto corrigió (5 de 12 muestreados).
 */
export function refSubzona(ref: GeoRef, nombre: string): GeoRef | null {
  switch (ref.nivel) {
    case 'nacional':
      return { nivel: 'ccaa', comunidad: nombre };
    case 'ccaa':
      return { nivel: 'provincia', comunidad: ref.comunidad, provincia: nombre };
    case 'provincia':
      return { nivel: 'comarca', comunidad: ref.comunidad, provincia: ref.provincia, comarca: nombre };
    case 'comarca':
      return { nivel: 'poblacion', comunidad: ref.comunidad, provincia: ref.provincia, poblacion: nombre };
    case 'poblacion':
      return null;
  }
}

/** Referencia del nivel superior (para canonical de páginas sin contenido y migas). */
export function nivelSuperior(ref: GeoRef): GeoRef | null {
  switch (ref.nivel) {
    case 'nacional':
      return null;
    case 'ccaa':
      return { nivel: 'nacional' };
    case 'provincia':
      return { nivel: 'ccaa', comunidad: ref.comunidad };
    case 'comarca':
    case 'poblacion':
      return { nivel: 'provincia', comunidad: ref.comunidad, provincia: ref.provincia };
  }
}

/** Zonas con contenido para el sitemap (INV-04: solo URLs 200 canónicas). */
export const zonasParaSitemap = memoPorVersion(function zonasParaSitemap(): { ref: GeoRef; ruta: string }[] {
  const arbol = construirArbol();
  const zonas: { ref: GeoRef; ruta: string }[] = [];
  for (const [, nodoCcaa] of arbol.ccaa) {
    const refC: GeoRef = { nivel: 'ccaa', comunidad: nodoCcaa.nombre };
    zonas.push({ ref: refC, ruta: rutaGeo(refC) });
    for (const [, prov] of nodoCcaa.provincias) {
      const refP: GeoRef = { nivel: 'provincia', comunidad: nodoCcaa.nombre, provincia: prov.nombre };
      zonas.push({ ref: refP, ruta: rutaGeo(refP) });
      for (const [, comarca] of prov.comarcas) {
        const refK: GeoRef = { nivel: 'comarca', comunidad: nodoCcaa.nombre, provincia: prov.nombre, comarca };
        zonas.push({ ref: refK, ruta: rutaGeo(refK) });
      }
    }
  }
  return zonas;
}, () => 'unica');

/** Provincia por slug. */
export function provinciaPorSlug(slug: string): Extract<GeoRef, { nivel: 'provincia' }> | null {
  for (const [, nodoCcaa] of construirArbol().ccaa) {
    const prov = nodoCcaa.provincias.get(slug);
    if (prov) return { nivel: 'provincia', comunidad: nodoCcaa.nombre, provincia: prov.nombre };
  }
  return null;
}

/** Todas las provincias (nombre + slug), para índices de familias por provincia. */
export const todasLasProvincias = memoPorVersion(function todasLasProvincias(): {
  slug: string;
  ref: Extract<GeoRef, { nivel: 'provincia' }>;
}[] {
  const provincias: { slug: string; ref: Extract<GeoRef, { nivel: 'provincia' }> }[] = [];
  for (const [, nodoCcaa] of construirArbol().ccaa)
    for (const [slug, prov] of nodoCcaa.provincias)
      provincias.push({ slug, ref: { nivel: 'provincia', comunidad: nodoCcaa.nombre, provincia: prov.nombre } });
  return provincias.sort((a, b) => a.ref.provincia.localeCompare(b.ref.provincia, 'es'));
}, () => 'unica');

/** Comarcas de una provincia (nombres normalizados), para selects en cascada. */
export function comarcasDeProvincia(slugProvincia: string): string[] {
  for (const [, nodoCcaa] of construirArbol().ccaa) {
    const prov = nodoCcaa.provincias.get(slugProvincia);
    if (prov) return [...prov.comarcas.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }
  return [];
}

/** Recuento por tipología de ruta en una zona (faceta "Tipo de centro" del buscador). */
export const tipologiasEnZona = memoPorVersion(
  function tipologiasEnZona(ref: GeoRef): { ruta: string; corto: string; centros: number }[] {
    return Object.entries(TIPOLOGIAS_RUTA)
      .filter(([, t]) => t.cod !== null)
      .map(([ruta, t]) => ({ ruta, corto: t.corto, centros: centrosDeZona(ref, t.cod).length }))
      .filter((t) => t.centros > 0);
  },
  (ref) => claveGeo(ref),
);

/** Nombre humano de la zona ("la comarca de X (Prov)", "Badalona", "España"…). */
export function nombreZona(ref: GeoRef): { corto: string; enFrase: string } {
  switch (ref.nivel) {
    case 'nacional':
      return { corto: 'España', enFrase: 'España' };
    case 'ccaa':
      return { corto: ref.comunidad, enFrase: ref.comunidad };
    case 'provincia':
      return { corto: ref.provincia, enFrase: `la provincia de ${ref.provincia}` };
    case 'comarca':
      return { corto: `${ref.comarca} (${ref.provincia})`, enFrase: `la comarca de ${ref.comarca}` };
    case 'poblacion':
      return { corto: `${ref.poblacion} - ${ref.provincia}`, enFrase: ref.poblacion };
  }
}

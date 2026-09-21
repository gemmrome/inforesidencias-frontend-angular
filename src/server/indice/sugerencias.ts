import '../server-only';

import { listar, metaIndice } from './store';
import { slugGeo } from './geo';

/**
 * Sugerencias de ZONA (población, comarca, provincia) para el buscador. Portado
 * literal de src/lib/indice/sugerencias.ts. Regla deliberada: se sugiere SOLO sobre
 * zonas con centros en el índice, nunca sobre el callejero completo del INE.
 */

export interface SugerenciaZona {
  tipo: 'poblacion' | 'comarca' | 'provincia';
  nombre: string;
  /** Contexto para desambiguar homónimos: "(Barcelona)" */
  contexto: string;
  centros: number;
  /** Segmentos de ruta bajo /centros/buscador/{tipologia} */
  segmentos: string;
}

interface Entrada extends SugerenciaZona {
  normalizado: string;
}

let cacheZonas: { version: string; zonas: Entrada[] } | null = null;

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function construir(): Entrada[] {
  const version = metaIndice().generado;
  if (cacheZonas && cacheZonas.version === version) return cacheZonas.zonas;

  const acc = new Map<
    string,
    { tipo: SugerenciaZona['tipo']; nombre: string; contexto: string; segmentos: string; centros: number }
  >();
  const suma = (clave: string, base: Omit<Entrada, 'centros' | 'normalizado'>) => {
    const e = acc.get(clave) ?? { ...base, centros: 0 };
    e.centros++;
    acc.set(clave, e);
  };

  for (const d of listar()) {
    const sc = slugGeo(d.comunidad);
    const sp = slugGeo(d.provincia);
    if (d.poblacion) {
      suma(`o:${sp}:${slugGeo(d.poblacion)}`, {
        tipo: 'poblacion',
        nombre: d.poblacion,
        contexto: d.provincia,
        segmentos: `${sc}/${sp}/${slugGeo(d.poblacion)}`,
      });
    }
    if (d.comarca) {
      suma(`k:${sp}:${slugGeo(d.comarca)}`, {
        tipo: 'comarca',
        nombre: d.comarca,
        contexto: d.provincia,
        segmentos: `${sc}/${sp}/${slugGeo(d.comarca)}`,
      });
    }
    suma(`p:${sp}`, { tipo: 'provincia', nombre: d.provincia, contexto: d.comunidad, segmentos: `${sc}/${sp}` });
  }

  const zonas: Entrada[] = [...acc.values()].map((z) => ({ ...z, normalizado: norm(z.nombre) }));
  cacheZonas = { version, zonas };
  return zonas;
}

/**
 * Zonas que empiezan por (o contienen) el texto. Orden: coincidencia por prefijo
 * primero, luego provincias > comarcas > poblaciones y más centros arriba.
 */
export function sugerirZonas(consulta: string, limite = 6): SugerenciaZona[] {
  const q = norm(consulta);
  if (q.length < 2) return [];
  const peso = { provincia: 0, comarca: 1, poblacion: 2 } as const;

  return construir()
    .filter((z) => z.normalizado.includes(q))
    .sort((a, b) => {
      const pa = a.normalizado.startsWith(q) ? 0 : 1;
      const pb = b.normalizado.startsWith(q) ? 0 : 1;
      return pa - pb || peso[a.tipo] - peso[b.tipo] || b.centros - a.centros;
    })
    .slice(0, limite)
    .map((z) => ({ tipo: z.tipo, nombre: z.nombre, contexto: z.contexto, centros: z.centros, segmentos: z.segmentos }));
}

/** Resuelve un código postal a su zona (población) — "08940" → Cornellà de Llobregat. */
export function zonaDeCodigoPostal(cp: string): SugerenciaZona | null {
  const doc = listar().find((d) => d.codigoPostal === cp);
  if (!doc) return null;
  const sc = slugGeo(doc.comunidad);
  const sp = slugGeo(doc.provincia);
  return {
    tipo: 'poblacion',
    nombre: doc.poblacion,
    contexto: `${doc.provincia} · CP ${cp}`,
    centros: listar().filter((d) => d.poblacion === doc.poblacion).length,
    segmentos: `${sc}/${sp}/${slugGeo(doc.poblacion)}`,
  };
}

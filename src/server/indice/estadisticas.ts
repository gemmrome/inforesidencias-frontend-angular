import '../server-only';

import { centrosDeZona, claveGeoPublica, slugGeo } from './geo';
import { memoPorVersion, metaIndice } from './store';
import { numES } from '../../app/shared/util/formato';
import type { GeoRef } from '../../app/shared/indice/tipos';

/**
 * Estadísticas de zona: ÚNICA fuente de verdad por cifra (COMP-02). Portado literal de
 * src/lib/indice/estadisticas.ts. El bloque editorial, las FAQs y el JSON-LD consumen
 * TODOS este objeto — la misma cifra con la misma fecha en los tres sitios.
 */
export interface EstadisticasZona {
  centros: number;
  plazasTotales: number | null;
  centrosConPlazas: number;
  precioDesdeMedio: number | null;
  precioDesdeMin: number | null;
  precioDesdeMax: number | null;
  centrosConPrecio: number;
  ratioMedio: number | null; // profesionales por cada 10 usuarios
  centrosConRatio: number;
  transparenciaMedia: number | null;
  centrosConTransparencia: number;
  fechaCalculo: string; // ISO de la sync del índice (E-E-A-T: fecha visible)
}

export const estadisticasDeZona = memoPorVersion(
  function estadisticasDeZona(ref: GeoRef, cod: number | null): EstadisticasZona {
    const docs = centrosDeZona(ref, cod);
    const conPlazas = docs.filter((d) => d.plazas !== null);
    const conPrecio = docs.filter((d) => d.precioDesde !== null);
    const conRatio = docs.filter((d) => d.ratioPersonal !== null);
    const conTransp = docs.filter((d) => d.transparencia !== null);
    const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

    const precioMedio = media(conPrecio.map((d) => d.precioDesde!));
    const ratio = media(conRatio.map((d) => d.ratioPersonal! / 10));
    const transp = media(conTransp.map((d) => d.transparencia!));

    return {
      centros: docs.length,
      plazasTotales: conPlazas.length ? conPlazas.reduce((s, d) => s + d.plazas!, 0) : null,
      centrosConPlazas: conPlazas.length,
      precioDesdeMedio: precioMedio !== null ? Math.round(precioMedio) : null,
      precioDesdeMin: conPrecio.length ? Math.min(...conPrecio.map((d) => d.precioDesde!)) : null,
      precioDesdeMax: conPrecio.length ? Math.max(...conPrecio.map((d) => d.precioDesde!)) : null,
      centrosConPrecio: conPrecio.length,
      ratioMedio: ratio !== null ? Math.round(ratio * 10) / 10 : null,
      centrosConRatio: conRatio.length,
      transparenciaMedia: transp !== null ? Math.round(transp) : null,
      centrosConTransparencia: conTransp.length,
      fechaCalculo: metaIndice().generado,
    };
  },
  (ref, cod) => `${cod}|${claveGeoPublica(ref)}`,
);

export function fechaCalculoLegible(e: EstadisticasZona): string {
  return new Date(e.fechaCalculo).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface PreciosSubzona {
  slug: string;
  nombre: string;
  centros: number;
  conPrecio: number;
  precioDesdeMedio: number | null;
  precioDesdeMin: number | null;
  precioDesdeMax: number | null;
}

/** Agregados de precio por subzona: por población dentro de una provincia, o por
 *  provincia a nivel nacional. La agrupación usa la sede, no el alcance. */
export const preciosPorSubzona = memoPorVersion(
  function preciosPorSubzona(ref: GeoRef, cod: number | null): PreciosSubzona[] {
    const grupos = new Map<string, { nombre: string; precios: number[]; centros: number }>();
    for (const d of centrosDeZona(ref, cod)) {
      const nombre = ref.nivel === 'nacional' ? d.provincia : d.poblacion;
      if (!nombre) continue;
      const clave = slugGeo(nombre);
      const g = grupos.get(clave) ?? { nombre, precios: [], centros: 0 };
      g.centros++;
      if (d.precioDesde !== null) g.precios.push(d.precioDesde);
      grupos.set(clave, g);
    }
    return [...grupos.entries()]
      .map(([slug, g]) => ({
        slug,
        nombre: g.nombre,
        centros: g.centros,
        conPrecio: g.precios.length,
        precioDesdeMedio: g.precios.length ? Math.round(g.precios.reduce((a, b) => a + b, 0) / g.precios.length) : null,
        precioDesdeMin: g.precios.length ? Math.min(...g.precios) : null,
        precioDesdeMax: g.precios.length ? Math.max(...g.precios) : null,
      }))
      .sort((a, b) => b.centros - a.centros || a.nombre.localeCompare(b.nombre, 'es'));
  },
  (ref, cod) => `${cod}|${claveGeoPublica(ref)}`,
);

/** Centros de una zona con una faceta verificable (RP-02): SOLO el "Sí" explícito cuenta. */
export const centrosConFaceta = memoPorVersion(
  function centrosConFaceta(ref: GeoRef, cod: number | null, faceta: string) {
    return centrosDeZona(ref, cod).filter((d) => d.facetas?.includes(faceta));
  },
  (ref, cod, faceta) => `${cod}|${faceta}|${claveGeoPublica(ref)}`,
);

/**
 * Ranking de transparencia (RP-02): SOLO centros con índice publicado. Orden: índice
 * desc → FECHA DE ACTUALIZACIÓN desc → nombre. Ver cabecera del original para el
 * porqué del desempate por fecha en vez de por plazas (PM, 2026-08-18: premiar tamaño
 * no dice nada de transparencia).
 */
export const rankingTransparencia = memoPorVersion(
  function rankingTransparencia(ref: GeoRef, cod: number | null, top: number) {
    return centrosDeZona(ref, cod)
      .filter((d) => d.transparencia !== null)
      .sort(
        (a, b) =>
          b.transparencia! - a.transparencia! ||
          (b.fechaActualizacion ?? '').localeCompare(a.fechaActualizacion ?? '') ||
          a.nombre.localeCompare(b.nombre, 'es'),
      )
      .slice(0, top);
  },
  (ref, cod, top) => `${cod}|${top}|${claveGeoPublica(ref)}`,
);

export interface FaqZona {
  pregunta: string;
  respuesta: string; // texto plano: se usa igual en la sección visible y en FAQPage JSON-LD
}

const euros = (n: number) => `${numES(n)} €/mes`;

/** FAQs por zona generadas SOLO de datos reales (COMP-02): cada respuesta usa las
 *  cifras de `EstadisticasZona`, nunca una cifra propia. */
export function faqsDeZona(e: EstadisticasZona, tipoCorto: string, zonaEnFrase: string): FaqZona[] {
  if (e.centros === 0) return [];
  const tipo = tipoCorto.toLowerCase();
  const articulo = /^residencia/i.test(tipoCorto) ? 'las' : 'los';
  const fecha = fechaCalculoLegible(e);
  const faqs: FaqZona[] = [];

  if (e.precioDesdeMedio !== null) {
    faqs.push({
      pregunta: `¿Cuánto cuestan ${articulo} ${tipo} en ${zonaEnFrase}?`,
      respuesta:
        `El precio de partida medio de ${articulo} ${tipo} en ${zonaEnFrase} es de ` +
        `${euros(e.precioDesdeMedio)}, calculado sobre los ${numES(e.centrosConPrecio)} ` +
        `centros que publican su precio en inforesidencias.com (a ${fecha}).` +
        (e.precioDesdeMin !== null && e.precioDesdeMax !== null && e.precioDesdeMax > e.precioDesdeMin
          ? ` Los precios de partida van desde ${euros(e.precioDesdeMin)} hasta ${euros(e.precioDesdeMax)}, según el tipo de habitación y los servicios incluidos.`
          : ''),
    });
  }

  faqs.push({
    pregunta: `¿${articulo === 'las' ? 'Cuántas' : 'Cuántos'} ${tipo} hay en ${zonaEnFrase}?`,
    respuesta:
      `En ${zonaEnFrase} hay ${numES(e.centros)} ${tipo} publicados en inforesidencias.com` +
      (e.plazasTotales !== null
        ? `, con un total de ${numES(e.plazasTotales)} plazas entre los ${numES(e.centrosConPlazas)} centros que informan de su capacidad`
        : '') +
      ` (a ${fecha}).`,
  });

  if (e.transparenciaMedia !== null || e.ratioMedio !== null) {
    faqs.push({
      pregunta: `¿Cómo comparar ${tipo} en ${zonaEnFrase}?`,
      respuesta:
        `Además del precio, compara el índice de transparencia (qué información verificable publica cada centro` +
        (e.transparenciaMedia !== null ? `; la media en ${zonaEnFrase} es del ${e.transparenciaMedia}%` : '') +
        `) y la ratio de personal` +
        (e.ratioMedio !== null
          ? ` (media de la zona: ${e.ratioMedio.toLocaleString('es-ES', { minimumFractionDigits: 1 })} profesionales por cada 10 usuarios)`
          : '') +
        `. Ambos datos aparecen en cada ficha y en este listado.`,
    });
  }

  return faqs;
}

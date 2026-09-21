import type { DocIndice } from '../indice/tipos';
import { numES } from '../util/formato';

/**
 * Puntos del mapa de resultados: única fuente de la regla, compartida por el endpoint
 * del servidor que los sirve bajo demanda y por el componente de mapa. Portado literal
 * de src/lib/buscador/puntos-mapa.ts (no llevaba `server-only` en el original: ya era
 * un módulo compartido).
 *
 * POR QUÉ SE SIRVEN BAJO DEMANDA (2026-08-07): en la página geográfica más pesada del
 * sitio, dos tercios del peso eran los puntos del mapa serializados para hidratar React
 * aunque el usuario nunca pulsara "Ver en el mapa". En Angular la razón es la misma —el
 * componente de mapa se carga de forma diferida (`@defer`) y sus puntos se piden a
 * `/api/v1/centros/mapa` solo cuando el usuario abre el mapa.
 */

/** Tope de puntos dibujados (docs/23 §B-4). */
export const MAX_PUNTOS_MAPA = 200;

export interface PuntoMapa {
  id: string;
  nombre: string;
  poblacion: string;
  precioDesde: number | null;
  transparencia: number | null;
  ruta: string;
  lat: number;
  lng: number;
  /** Marca "este es el centro que estabas mirando" (ficha sin información, docs/26). */
  destacado?: boolean;
}

/** Caja de España (Canarias incluidas) para descartar coordenadas imposibles. */
function coordenadaPlausible(c: DocIndice): boolean {
  return Boolean(c.geo && c.geo.lat >= 27.5 && c.geo.lat <= 43.9 && c.geo.lng >= -18.3 && c.geo.lng <= 4.4);
}

export interface PuntosDeMapa {
  puntos: PuntoMapa[];
  /** Resultados del filtro que NO salen en el mapa: sin coordenadas o fuera del tope. */
  sinCoordenadas: number;
  /** Cuántos de los dibujados publican precio. Lo necesita el pie del mapa. */
  conPrecio: number;
}

/** Convierte los centros YA FILTRADOS de una zona en los puntos del mapa. Función pura. */
export function puntosDeMapa(centros: DocIndice[]): PuntosDeMapa {
  const plausibles = centros.filter(coordenadaPlausible);
  const puntos: PuntoMapa[] = plausibles.slice(0, MAX_PUNTOS_MAPA).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    poblacion: c.poblacion,
    precioDesde: c.precioDesde,
    transparencia: c.transparencia,
    ruta: new URL(c.url).pathname,
    lat: c.geo!.lat,
    lng: c.geo!.lng,
  }));
  return {
    puntos,
    sinCoordenadas: centros.length - puntos.length,
    conPrecio: puntos.filter((p) => p.precioDesde !== null).length,
  };
}

export interface ResumenMapa {
  total: number;
  /** true cuando el filtro tiene MÁS resultados plausibles que el tope de dibujado. */
  topeAlcanzado: boolean;
  sinCoordenadas: number;
  /** De dónde pedir los puntos cuando el usuario pulse. */
  url: string;
}

/** Resumen barato: cuenta sin construir ni serializar un solo punto. */
export function resumenDeMapa(centros: DocIndice[], url: string): ResumenMapa {
  const plausibles = centros.filter(coordenadaPlausible).length;
  const total = Math.min(plausibles, MAX_PUNTOS_MAPA);
  return { total, topeAlcanzado: plausibles > MAX_PUNTOS_MAPA, sinCoordenadas: centros.length - total, url };
}

/** Texto del botón cerrado del mapa. */
export function textoBotonMapa(total: number, topeAlcanzado: boolean): string {
  return topeAlcanzado ? `Ver +${numES(total)} en el mapa` : `Ver ${numES(total)} centros en el mapa`;
}

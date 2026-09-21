/**
 * Qué pestañas tiene la galería de una ficha — y cuáles NO existen. Portado literal de
 * src/lib/galeria/pestanas.ts. Función pura, sin React/Angular: es la regla de negocio
 * de «lo que no hay no se nombra» (PM, 2026-08-17).
 */

export type ClavePestana = 'centro' | 'comida' | 'videos';

export interface Pestana {
  clave: ClavePestana;
  etiqueta: string;
}

/** El orden es fijo: lo primero es el centro, porque su primera foto es el elemento LCP. */
const ORDEN: ReadonlyArray<Pestana> = [
  { clave: 'centro', etiqueta: 'El centro' },
  { clave: 'comida', etiqueta: 'La comida' },
  { clave: 'videos', etiqueta: 'Vídeos' },
];

export interface ContenidoGaleria {
  /** Nº de fotos del ámbito IMAGENES de la API. */
  fotosCentro: number;
  /** ¿Hay algo de comida que enseñar (platos, cocina o menús)? */
  hayComida: boolean;
  /** Nº de vídeos del ámbito VIDEOS. */
  videos: number;
}

/** Las pestañas CON CONTENIDO, en orden. Nunca se devuelve una pestaña vacía. */
export function pestanasDeGaleria(c: ContenidoGaleria): Pestana[] {
  const tiene: Record<ClavePestana, boolean> = {
    centro: c.fotosCentro > 0,
    comida: c.hayComida,
    videos: c.videos > 0,
  };
  return ORDEN.filter((p) => tiene[p.clave]);
}

/** ¿Se pinta la barra de pestañas? Con un solo grupo con contenido NO. */
export function hayQuePintarPestanas(pestanas: Pestana[]): boolean {
  return pestanas.length > 1;
}

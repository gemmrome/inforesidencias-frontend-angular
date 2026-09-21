/**
 * Modelo limpio de lo que una residencia publica sobre su comida en el proyecto hermano
 * «Aquí se come bien». Portado literalmente de src/lib/domain/comida.ts.
 *
 * ESTA FRONTERA ES UNA VALLA DE PRIVACIDAD, no solo de estilo: el origen guarda por foto
 * la geolocalización y un análisis nutricional generado por IA. Ninguno de los dos existe
 * aquí, así que no pueden llegar a la página aunque el origen los mande (ver adaptador
 * `src/server/adapter/comida.ts`).
 */

/** Quién come qué. Lo elige la persona que sube la foto, no la IA. */
export type MomentoComida = 'desayuno' | 'comida' | 'cena';

export interface FotoPlato {
  id: string;
  url: string;
  /** Ausente si el origen no la trae. */
  miniatura?: string;
  momento?: MomentoComida;
  /** Fecha real de la comida, en formato ISO `AAAA-MM-DD`. */
  fecha: string;
  /** Texto REVISADO POR EL CENTRO, si lo hay. Nunca el nombre de plato generado por IA. */
  texto?: string;
}

export interface MenuSemanal {
  id: string;
  /** URL del PDF. Un menú sin PDF no llega hasta aquí. */
  pdf: string;
  /** ISO `AAAA-MM-DD`; ausentes si el origen no acota la vigencia. */
  desde?: string;
  hasta?: string;
}

export interface ComidaCentro {
  platos: FotoPlato[];
  cocina: string[];
  menus: MenuSemanal[];
  /** Fecha de la última foto de plato publicada (ISO), si hay alguna. */
  ultimaPublicacion?: string;
}

/** ¿Hay algo que enseñar? Un bloque vacío no se pinta ni se nombra. */
export function tieneComida(c: ComidaCentro | null): c is ComidaCentro {
  return !!c && (c.platos.length > 0 || c.cocina.length > 0 || c.menus.length > 0);
}

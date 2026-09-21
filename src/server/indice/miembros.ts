import '../server-only';

import { listar, memoPorVersion } from './store';
import type { DocIndice } from '../../app/shared/indice/tipos';

/**
 * Qué se le ofrece a quien llega a la ficha de un centro que no ha facilitado
 * información. Portado literal de src/lib/indice/miembros.ts. Decisión de PM
 * (2026-08-06, docs/26): centros asociados más transparentes de su población; si no hay,
 * comarca; si tampoco, provincia. Nunca se salta a otra provincia.
 */
export interface SugerenciasMiembros {
  centros: DocIndice[];
  /** Hasta dónde hubo que ampliar la búsqueda para reunirlos. */
  nivel: 'poblacion' | 'comarca' | 'provincia';
  /** Nombre de la zona alcanzada, para el texto visible. */
  zona: string;
}

const MINIMO_UTIL = 2; // con una sola sugerencia la sección no compensa su propio ruido
const MAXIMO_SUGERENCIAS = 4; // cuatro caben en dos filas de dos

function candidatos(docs: DocIndice[], centroId: number, codTipologia: number): DocIndice[] {
  return docs
    .filter(
      (d) =>
        d.esMiembro === true &&
        d.centroId !== centroId && // nunca sugerirse a sí mismo
        d.codTipologia === codTipologia && // quien mira una residencia busca residencias
        d.transparencia != null,
    )
    .sort((a, b) => (b.transparencia ?? 0) - (a.transparencia ?? 0));
}

/**
 * Recibe identificadores y no un `DocIndice` a propósito: la ficha viene de la API, no
 * del índice. Si el centro no está en el índice, devuelve null y la ficha simplemente
 * no pinta sugerencias.
 */
export const miembrosSugeridos = memoPorVersion(
  function miembrosSugeridos(centroId: number, codTipologia: number): SugerenciasMiembros | null {
    const docs = listar();
    const doc = docs.find((d) => d.centroId === centroId && d.codTipologia === codTipologia);
    if (!doc) return null;
    const pool = candidatos(docs, doc.centroId, doc.codTipologia);

    const escalones: { nivel: SugerenciasMiembros['nivel']; zona: string; filtro: (d: DocIndice) => boolean }[] = [
      { nivel: 'poblacion', zona: doc.poblacion, filtro: (d) => d.poblacion === doc.poblacion && d.provincia === doc.provincia },
      { nivel: 'comarca', zona: doc.comarca, filtro: (d) => d.comarca === doc.comarca && d.provincia === doc.provincia },
      { nivel: 'provincia', zona: doc.provincia, filtro: (d) => d.provincia === doc.provincia },
    ];

    for (const e of escalones) {
      if (!e.zona) continue; // hay centros sin comarca declarada: se salta ese escalón
      const centros = pool.filter(e.filtro).slice(0, MAXIMO_SUGERENCIAS);
      if (centros.length >= MINIMO_UTIL) return { centros, nivel: e.nivel, zona: e.zona };
    }

    // Sin nada que ofrecer, null: es mejor no tener sugerencias que una sección vacía.
    return null;
  },
  (centroId, codTipologia) => `${centroId}|${codTipologia}`,
);

/** Dónde se da de alta un centro, por tipología. Páginas REALES de producción
 *  (verificadas con 200 el 2026-08-06); no inventar rutas nuevas. */
const ALTA_POR_TIPOLOGIA: Record<number, string> = {
  1: '/registro-centro', // residencia
  2: '/registro-centro', // centro de día — la misma página cubre ambos
  8: '/registro-sad',
  10: '/registro-teleasistencia',
};

/** Para tipologías sin página propia, al hub `/registrarse`. */
export function urlAltaCentro(codTipologia: number, sitio: string): string {
  return `${sitio}${ALTA_POR_TIPOLOGIA[codTipologia] ?? '/registrarse'}`;
}

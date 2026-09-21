/**
 * Modelo de dominio limpio que consume el frontend (contrato público v1, docs/11).
 * Ningún tipo *BeanAPI ni campo interno de negocio cruza esta frontera.
 *
 * Portado literalmente de src/lib/domain/centro.ts. Es un fichero de tipos e interfaces
 * puro: no cambia nada al pasar de Next a Angular.
 */

export interface Caracteristica {
  nombre: string;
  etiqueta: string;
  valor: string | number | boolean;
}

export interface GrupoCaracteristicas {
  ambito: string;
  etiqueta: string;
  caracteristicas: Caracteristica[];
}

export interface Recurso {
  tipo: 'imagen' | 'documento' | 'video' | 'otro';
  /** Clave del recurso en el origen (MODELO-CONTRATO, REGLAMENTO…). Es lo que permite
   *  emparejar cada PDF con su descripción en el ámbito DOCUMENTACION. */
  nombre?: string;
  url: string;
  titulo?: string;
  etiqueta?: string;
  thumbnail?: string;
}

/**
 * Un documento del centro, YA UNIFICADO: el PDF y el texto que el centro escribió sobre él
 * son la misma cosa y se publican juntos. Ver la cabecera del fichero original para el
 * porqué (docs/14 §PM 2026-08-14: dos secciones duplicadas → una).
 */
export interface DocumentoCentro {
  clave: string; // REGLAMENTO, MODELO-CONTRATO…
  etiqueta: string; // "Reglamento de régimen interior"
  url?: string; // ausente si el centro describió el documento pero no lo subió
  descripcion?: string; // texto libre del centro sobre ese documento
}

export interface GrupoRecursos {
  ambito: string;
  etiqueta: string;
  recursos: Recurso[];
}

/**
 * Lo que la API afirma sobre las plazas de un tipo de habitación. Unión y no `boolean`
 * a propósito: "Últimas plazas" no puede convertirse en "no disponible" (ver adaptador).
 */
export type DisponibilidadHabitacion = 'disponible' | 'ultimas-plazas' | 'sin-plazas';

export interface PrecioHabitacion {
  codigo: string; // HICB, HCHCB…
  etiqueta: string; // "Individual con baño"
  /** Ausente cuando la API no lo dice. NUNCA se rellena con "sin plazas" por defecto. */
  disponibilidad?: DisponibilidadHabitacion;
  precio?: number; // €/mes; ausente si el centro no lo publica
}

export interface PreciosCentro {
  mostrarEnFicha: boolean; // ← MOSTRAR-PRECIOS-EN-FICHA
  sistema?: string; // ← SISTEMA-DE-PRECIOS ("A consultar con el centro"…)
  habitaciones: PrecioHabitacion[];
}

export interface Centro {
  id: number;
  slug: string;
  nombre: string;
  tipologia: string;
  tipologiaCod: number;
  tipologiaRuta: string; // segmento de URL de la ficha (residencia | centro-de-dia-para-mayores | …)
  grupo?: string;
  esMiembro: boolean;
  transparencia?: { indice: number; razon?: string; tramo: string };
  contacto: {
    direccion?: string;
    codigoPostal?: string;
    poblacion: { id: number; nombre: string; comarca?: string; provincia: string; comunidad: string };
    telefono?: string;
    web?: string;
  };
  geo?: { lat: number; lng: number };
  eslogan?: string;
  descripcionHtml?: string;
  porqueElegimos?: string;
  titular?: string;
  registro?: string;
  plazasTotales?: number;
  precios?: PreciosCentro;
  caracteristicas: GrupoCaracteristicas[];
  /** Documentos del centro (PDF + descripción), única fuente. El ámbito DOCUMENTACION
   *  NO aparece ya ni en `caracteristicas` ni en `recursos`. */
  documentacion: DocumentoCentro[];
  recursos: GrupoRecursos[];
  fechaActualizacion?: string;
}

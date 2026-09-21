/**
 * Formas de datos del índice de centros, compartidas entre el servidor (que construye y
 * consulta el índice, en `src/server/indice/`) y el cliente (que solo las RECIBE ya
 * resueltas desde los endpoints `/api/v1/...` — nunca lee el fichero del índice ni
 * ejecuta MiniSearch en el navegador).
 *
 * Portado de las interfaces de src/lib/indice/store.ts y src/lib/indice/geo.ts.
 */

export interface DocIndice {
  id: string; // `${codTipologia}-${centroId}`
  centroId: number;
  codTipologia: number;
  tipologia: string;
  nombre: string;
  comunidad: string;
  provincia: string; // sede del centro
  comarca: string;
  poblacion: string;
  codigoPostal: string;
  direccion: string;
  plazas: number | null;
  precioDesde: number | null;
  ratioPersonal: number | null;
  transparencia: number | null;
  url: string;
  imagen: string | null;
  provinciasAlcance: string[]; // provincias donde el centro aparece (sede + servicio: SAD nacionales)
  /** Facetas verificables (anexo RP-02; solo "Sí" explícito). Ausente si aún no se enriqueció. */
  facetas?: string[];
  /** Coordenadas del centro (modo `geo` de la sync). ~76% de cobertura nacional. */
  geo?: { lat: number; lng: number };
  /** Última actualización que declara el centro, ISO `yyyy-mm-dd`. Ausente = no consultado. */
  fechaActualizacion?: string | null;
  /** Centro asociado (modo `miembros`). `undefined` = "no consultado", NO "no es miembro". */
  esMiembro?: boolean;
}

export interface MetaIndice {
  generado: string;
  modo: string;
  totalDocs: number;
  porTipologia: Record<string, number>;
}

export interface FiltroIndice {
  codTipologia?: number;
  provincia?: string; // filtra por alcance (incluye SAD que sirven la provincia)
  poblacion?: string;
  comarca?: string;
  /** Facetas RP-02 que debe cumplir TODAS (AND). */
  facetas?: string[];
  /** Precio "desde" mínimo en €/mes. Excluye centros sin precio publicado. */
  precioMin?: number;
  /** Precio "desde" máximo en €/mes. Excluye centros sin precio publicado. */
  precioMax?: number;
  /** Plazas mínimas del centro. */
  plazasMin?: number;
}

export type OrdenListado = 'transparencia' | 'actualizacion';

export type GeoRef =
  | { nivel: 'nacional' }
  | { nivel: 'ccaa'; comunidad: string }
  | { nivel: 'provincia'; comunidad: string; provincia: string }
  | { nivel: 'comarca'; comunidad: string; provincia: string; comarca: string }
  | { nivel: 'poblacion'; comunidad: string; provincia: string; poblacion: string };

export interface Subzona {
  slug: string;
  nombre: string;
  centros: number;
}

/** Tipologías con página geográfica propia. `cod: null` = directorio (todas). Portado de
 *  src/lib/indice/geo.ts — es dato de configuración, no lógica de servidor, así que vive
 *  en shared y lo usan tanto el servidor (construir el árbol) como el cliente (menús). */
export const TIPOLOGIAS_RUTA: Record<string, { cod: number | null; plural: string; corto: string }> = {
  residencias: { cod: 1, plural: 'Residencias geriátricas', corto: 'Residencias' },
  'centros-de-dia-para-mayores': { cod: 2, plural: 'Centros de día para mayores', corto: 'Centros de día' },
  'servicio-de-atencion-domiciliaria': {
    cod: 8,
    plural: 'Empresas de ayuda a domicilio',
    corto: 'Empresas de ayuda a domicilio',
  },
  teleasistencia: { cod: 10, plural: 'Teleasistencia', corto: 'Servicios de teleasistencia' },
  'apartamentos-con-servicios': {
    cod: 13,
    plural: 'Apartamentos con servicios',
    corto: 'Apartamentos con servicios',
  },
  directorio: { cod: null, plural: 'Centros para mayores', corto: 'Centros' },
};

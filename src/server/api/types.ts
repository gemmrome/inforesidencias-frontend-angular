/**
 * Tipos del contrato OBSERVADO de la API interna (api.inforesidencias.com). Portado
 * literal de src/lib/api/types.ts. Reflejan la respuesta real validada el 2026-08-03
 * (prueba vertical, centro 14132): `caracteristicas` y `recursos` llegan como MAPAS por
 * ámbito, no como arrays. Estos tipos NO deben salir del adaptador (capa
 * anticorrupción, docs/11) — no se importan fuera de `src/server/adapter/`.
 */

export interface PoblacionBeanAPI {
  id: number;
  comunidad: string;
  provincia: string;
  comarca: string | null;
  poblacion: string;
  centros: number | null;
}

export interface DatosGeneralesBeanAPI {
  tipologia: number;
  nombre: string;
  titular: string | null;
  nif: string | null;
  direccion: string | null;
  idPoblacion: number;
  cp: string | null;
  distrito: string | null;
  telefono: string | null;
  fax: string | null;
  email: string | null;
  emailAdministrativo: string | null;
  web: string | null;
  personaContacto: string | null;
  geoLong: string | null;
  geoLat: string | null;
  eslogan: string | null;
  porqueElegimos: string | null;
  registro: string | null;
  asociacion: string | null;
  fechaActualizacion: string | null;
  peso: number | null;
  fechaCaducidadPromocion: string | null;
  clientePremium: boolean | null;
  provinciasClientePremium: string | null;
  seoDescriptionExt: string | null;
  fechaActualizacionDescriptionExt: string | null;
  fechaRenovacionDescriptionExt: string | null;
  observaciones: string | null;
  etiqueta: string | null;
  provinciasServicio: string | null;
}

export interface CaracteristicaBeanAPI {
  ambito: string;
  nombre: string;
  valor: string;
}

export interface GrupoCaracteristicasBeanAPI {
  ambito: string;
  etiqueta: string;
  caracteristicas: CaracteristicaBeanAPI[];
}

export interface RecursoBeanAPI {
  ambito: string;
  nombre: string;
  tipologia: string | null;
  etiqueta: string | null;
  url: string | null;
  titulo: string | null;
  tipo: string | null;
  thumbnail: string | null;
}

export interface GrupoRecursosBeanAPI {
  ambito: string;
  etiqueta: string;
  recursos: Record<string, RecursoBeanAPI>;
}

export interface CentroBeanAPI {
  id: number;
  caracteristicas: Record<string, GrupoCaracteristicasBeanAPI>;
  recursos: Record<string, GrupoRecursosBeanAPI>;
  poblacion: PoblacionBeanAPI;
  valorTransparencia: number | null;
  relacionTransparencia: string | null;
  miembro: boolean;
  nombreTipologia: string | null;
  nombreGrupo: string | null;
  nombrePeso: string | null;
  datosGenerales: DatosGeneralesBeanAPI;
}

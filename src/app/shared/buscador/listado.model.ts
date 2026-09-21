import type { DatosPanel, FiltrosListado } from './filtros';
import type { ResumenMapa } from './puntos-mapa';
import type { DocIndice, OrdenListado, Subzona } from '../indice/tipos';

/**
 * Forma de la respuesta de `GET /api/v1/listado` (ver `src/server/routes/listado.ts`).
 * Es el equivalente-dato de lo que en el original calculaba `contenidoDe()` dentro de
 * la página de servidor — aquí es lo que el cliente HTTP recibe y `ListadoPageComponent`
 * pinta, sin recalcular nada.
 */
export interface EstadisticasZona {
  centros: number;
  plazasTotales: number | null;
  centrosConPlazas: number;
  precioDesdeMedio: number | null;
  precioDesdeMin: number | null;
  precioDesdeMax: number | null;
  centrosConPrecio: number;
  ratioMedio: number | null;
  centrosConRatio: number;
  transparenciaMedia: number | null;
  centrosConTransparencia: number;
  fechaCalculo: string;
}

export interface FaqZona {
  pregunta: string;
  respuesta: string;
}

export interface ContextoListado {
  rutaTipologia: string;
  tipoCod: number | null;
  tipoPlural: string;
  tipoCorto: string;
  nivel: 'nacional' | 'ccaa' | 'provincia' | 'comarca' | 'poblacion';
  provincia: string | null;
  zonaCorto: string;
  zonaEnFrase: string;
  canonicalSuperior: string | null;
}

export interface SubzonaConHref extends Subzona {
  href: string;
}

export interface TipologiaEnZona {
  ruta: string;
  corto: string;
  centros: number;
  href: string;
}

export interface ListadoProvincia {
  slug: string;
  corto: string;
  provinciaSlug: string;
}

export interface RespuestaListado {
  encontrado: true;
  ctx: ContextoListado;
  base: string;
  filtros: FiltrosListado;
  orden: OrdenListado;
  puedeOrdenarPorFecha: boolean;
  centrosTotal: number;
  candidatosTotal: number;
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  visibles: DocIndice[];
  panel: DatosPanel;
  resumenMapa: ResumenMapa;
  estadisticas: EstadisticasZona;
  faqs: FaqZona[];
  subzonas: SubzonaConHref[];
  etiquetaSub: string;
  tipologiasEnZona: TipologiaEnZona[];
  listadosProvincia: ListadoProvincia[];
  fechaSync: string;
}

export interface RespuestaListadoRedirect {
  encontrado: false;
  /** Presente solo cuando la zona no existe pero su provincia sí (redirección permanente). */
  redirect?: string;
}

export type RespuestaListadoApi = RespuestaListado | RespuestaListadoRedirect;

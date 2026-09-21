import type { Centro } from '../dominio/centro.model';
import type { ComidaCentro } from '../dominio/comida.model';
import type { Pestana } from '../galeria/pestanas';
import type { DocIndice } from '../indice/tipos';

/**
 * Forma de la respuesta de `GET /api/v1/ficha-centro` (ver
 * `src/server/routes/ficha-centro.ts`). Equivalente-dato de lo que el original
 * calculaba en `Ficha()`/`centroDeParams()` dentro de la página de servidor — aquí es
 * lo que `FichaCentroPageComponent` recibe y pinta, sin recalcular nada. Portado de
 * src/app/(sitio)/centros/[tipo]/[id]/[slug]/page.tsx.
 *
 * El único cálculo que SÍ vive en el cliente es el `<script type="application/ld+json">`
 * (con `jsonLdSeguro`, que es isomorfa) a partir del array `jsonLd` que manda el servidor.
 */

export interface EnlaceTexto {
  texto: string;
  href: string;
}

export interface MigaFicha {
  comunidad: EnlaceTexto;
  provincia: EnlaceTexto;
  poblacion: EnlaceTexto;
}

export interface ImagenGaleria {
  url: string;
  alt: string;
  /** Solo la primera foto de "El centro" la lleva: es el elemento LCP de la ficha. */
  prioritaria: boolean;
}

export interface VideoGaleria {
  url: string;
  titulo: string;
}

export interface SugerenciasMiembrosApi {
  centros: DocIndice[];
  nivel: 'poblacion' | 'comarca' | 'provincia';
  zona: string;
}

export interface EnlacesZona {
  otrasEnPoblacion: EnlaceTexto;
  preciosProvincia?: EnlaceTexto;
  masTransparentesProvincia?: EnlaceTexto;
}

/** Centro que SÍ ha facilitado información: la ficha completa. */
export interface RespuestaFichaMiembro {
  encontrado: true;
  esMiembro: true;
  centro: Centro;
  migaFicha: MigaFicha;
  direccionCompleta: string;
  logo?: string;
  /** `centro.grupo` sin repetir la etiqueta ("Grupo DomusVi" → "DomusVi" en el <dd>,
   *  ver `valorSinRepetirEtiqueta`). Solo para ese punto; el resto de usos (alt del
   *  logo, JSON-LD) siguen leyendo `centro.grupo` tal cual. */
  grupoEtiqueta?: string;
  imagenes: ImagenGaleria[];
  videos: VideoGaleria[];
  comida: ComidaCentro | null;
  pestanas: Pestana[];
  jsonLd: object[];
  tituloPagina: string;
  enlacesZona: EnlacesZona;
  /** "18 de julio de 2026", ya formateada (sin hora: la API la manda siempre a las
   *  12:00, así que publicarla insinuaría una precisión que el dato no tiene). Null si
   *  la fecha de la API no viene en el formato esperado. */
  fechaActualizacionLegible: string | null;
}

/** Centro que NO ha facilitado información: ficha reducida (docs/26). */
export interface RespuestaFichaNoMiembro {
  encontrado: true;
  esMiembro: false;
  centro: {
    nombre: string;
    tipologia: string;
    direccion?: string;
    codigoPostal?: string;
    poblacion: string;
    provincia: string;
    geo?: { lat: number; lng: number };
  };
  migaFicha: MigaFicha;
  sugerencias: SugerenciasMiembrosApi | null;
  urlAlta: string;
  tituloPagina: string;
  jsonLd: object[];
}

export interface RespuestaFichaNoEncontrada {
  encontrado: false;
}

export type RespuestaFichaCentro = RespuestaFichaMiembro | RespuestaFichaNoMiembro | RespuestaFichaNoEncontrada;

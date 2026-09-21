import '../server-only';

import type { CentroBeanAPI, CaracteristicaBeanAPI, GrupoRecursosBeanAPI } from '../api/types';
import type {
  Centro,
  Caracteristica,
  DisponibilidadHabitacion,
  DocumentoCentro,
  GrupoCaracteristicas,
  GrupoRecursos,
  PreciosCentro,
  Recurso,
} from '../../app/shared/dominio/centro.model';
import { getCentroRaw } from '../api/client';
import { etiquetaDesdeNombre, valorSinRepetirEtiqueta, CLAVES_OCULTAS, ETIQUETAS_AMBITOS } from './etiquetas';

/**
 * Capa anticorrupción (ARCH-01, docs/11): traduce el contrato heredado *BeanAPI al
 * modelo de dominio limpio. Portado LITERAL de src/lib/adapter/centro.ts — cada regla
 * de negocio de este fichero está verificada contra el índice real y documentada con su
 * fecha y su razón; el puerto a Angular no cambia ni una. Reglas: mapas por ámbito →
 * arrays ordenados; "Sí"/"No" → boolean · "108,00" (coma decimal) → number; URLs
 * relativas → absolutas; tramo de transparencia derivado del índice; campos
 * internos/personales NUNCA se propagan (GDPR).
 */

const ASSETS_HOST = process.env['ASSETS_HOST'] ?? 'https://www.inforesidencias.com';

const ORDEN_AMBITOS = [
  'HABITACIONES',
  'USUARIOS',
  'INSTALACIONES',
  'SERVICIOS',
  'EQUIPO-PROFESIONAL',
  'CERTIFICADOS',
  'DOCUMENTACION',
];

/** Segmento de URL de la ficha por código de tipología, confirmado con las URLs
 *  canónicas que devuelve la propia API (2026-08-04): los subtipos 3-7 y 9 usan
 *  /residencia/ (quirk heredado que se preserva por SEO). */
const RUTA_FICHA_POR_COD: Record<number, string> = {
  1: 'residencia',
  2: 'centro-de-dia-para-mayores',
  8: 'servicio-de-atencion-domiciliaria',
  10: 'teleasistencia',
  13: 'apartamentos-con-servicios',
};

export function rutaFichaDeCod(cod: number): string {
  return RUTA_FICHA_POR_COD[cod] ?? 'residencia';
}

/** Segmentos válidos de la ruta de ficha /centros/[tipo]/[id]/[slug]. */
export const TIPOS_FICHA = [...new Set(Object.values(RUTA_FICHA_POR_COD))];

export function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos fuera (Vallès → Valles)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseValor(valor: string): string | number | boolean {
  const v = valor.trim();
  if (/^s[ií]$/i.test(v)) return true;
  if (/^no$/i.test(v)) return false;
  // Formatos numéricos españoles observados: "108,00", "3000,00", "2.600"
  if (/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(v)) {
    return parseFloat(v.replace(/\./g, '').replace(',', '.'));
  }
  return v;
}

export function tramoTransparencia(indice: number): string {
  if (indice >= 75) return 'Muy alta';
  if (indice >= 60) return 'Alta';
  if (indice >= 40) return 'Regular';
  if (indice > 0) return 'Baja';
  return 'Sin datos';
}

// Códigos de habitación observados en HABITACIONES (validados con centro 13977):
// H(I|CH|CM)(C|S)B = Individual/Compartida-hombre/Compartida-mujer, Con/Sin Baño.
const TIPOS_HABITACION: Record<string, string> = {
  HICB: 'Individual con baño',
  HISB: 'Individual sin baño',
  HCHCB: 'Compartida hombre con baño',
  HCHSB: 'Compartida hombre sin baño',
  HCMCB: 'Compartida mujer con baño',
  HCMSB: 'Compartida mujer sin baño',
};

const RE_PRECIO_HAB = /^(H[A-Z]+)-(PRECIO|ESTADO)$/;

/** Traduce el `H*-ESTADO` de la API. `undefined` = "no lo sabemos", nunca "no hay". */
function disponibilidadHabitacion(valor: unknown): DisponibilidadHabitacion | undefined {
  switch (valor) {
    case 'Disponible':
      return 'disponible';
    case 'Últimas plazas':
      return 'ultimas-plazas';
    case 'No disponible':
      return 'sin-plazas';
    default:
      return undefined;
  }
}

/**
 * Separa del ámbito HABITACIONES el modelo de precios del centro. LA FILA SOLO
 * SOBREVIVE SI APORTA ALGO: un precio, o la afirmación de que hay plazas (petición de
 * PM, 2026-08-17: ver medición completa en la cabecera del fichero original — 50% de
 * las filas no decían nada del centro y se retiran).
 */
function extraerPrecios(grupos: GrupoCaracteristicas[]): PreciosCentro | undefined {
  const hab = grupos.find((g) => g.ambito === 'habitaciones');
  if (!hab) return undefined;
  const habitaciones: Record<string, { disponibilidad?: DisponibilidadHabitacion; precio?: number }> = {};
  let mostrar = false;
  let sistema: string | undefined;
  const resto: Caracteristica[] = [];
  for (const c of hab.caracteristicas) {
    const m = RE_PRECIO_HAB.exec(c.nombre);
    if (c.nombre === 'MOSTRAR-PRECIOS-EN-FICHA') {
      mostrar = c.valor === true;
    } else if (c.nombre === 'SISTEMA-DE-PRECIOS') {
      sistema = String(c.valor);
    } else if (m) {
      const slot = (habitaciones[m[1]] ??= {});
      if (m[2] === 'PRECIO' && typeof c.valor === 'number') slot.precio = c.valor;
      if (m[2] === 'ESTADO') slot.disponibilidad = disponibilidadHabitacion(c.valor);
    } else {
      resto.push(c);
    }
  }
  hab.caracteristicas = resto; // el grupo genérico se queda sin los códigos de precio
  return {
    mostrarEnFicha: mostrar,
    sistema,
    habitaciones: Object.entries(habitaciones)
      .filter(
        ([, v]) => v.precio !== undefined || v.disponibilidad === 'disponible' || v.disponibilidad === 'ultimas-plazas',
      )
      .map(([codigo, v]) => ({
        codigo,
        etiqueta: TIPOS_HABITACION[codigo] ?? codigo,
        disponibilidad: v.disponibilidad,
        precio: v.precio,
      })),
  };
}

/**
 * CERTIFICACIONES: fuera lo que el centro marcó "No" (petición de PM, 2026-08-14). Solo
 * se aplica a este ámbito, A PROPÓSITO — en Instalaciones el "No" sí informa (piscina,
 * parking). Cae también el `<CLAVE>-TEXTO` emparejado.
 */
function filtrarCertificacionesEnNo(caracteristicas: Caracteristica[]): Caracteristica[] {
  const enNo = new Set(caracteristicas.filter((c) => c.valor === false).map((c) => c.nombre));
  return caracteristicas.filter((c) => !enNo.has(c.nombre) && !enNo.has(c.nombre.replace(/-TEXTO$/, '')));
}

/**
 * RATIO DE PERSONAL: se publica con la frase completa (petición de PM, 2026-08-14). El
 * 0 NO es un ratio: es el valor por defecto de una ficha sin rellenar (~87% del
 * corpus), así que se omite la fila entera.
 */
function fraseRatioPersonal(valor: string): string | null {
  const n = parseFloat(valor.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} trabajadores por cada 10 usuarios`;
}

function toCaracteristica(c: CaracteristicaBeanAPI): Caracteristica | null {
  const etiqueta = etiquetaDesdeNombre(c.nombre);
  if (c.nombre === 'RATIO-DE-PERSONAL') {
    const frase = fraseRatioPersonal(c.valor);
    return frase ? { nombre: c.nombre, etiqueta, valor: frase } : null;
  }
  const valor = parseValor(c.valor);
  return {
    nombre: c.nombre,
    etiqueta,
    valor: typeof valor === 'string' ? valorSinRepetirEtiqueta(etiqueta, valor) : valor,
  };
}

function absolutizar(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`; // relativa a protocolo (vídeos YouTube)
  return `${ASSETS_HOST}/${url.replace(/^\/+/, '')}`;
}

function tipoRecurso(ambito: string): Recurso['tipo'] {
  if (ambito === 'IMAGENES' || ambito === 'LOGOS') return 'imagen';
  if (ambito === 'DOCUMENTACION') return 'documento';
  if (ambito === 'VIDEOS') return 'video';
  return 'otro';
}

// La API trae erratas en etiquetas ("Imágnes") → literales propios, no del origen.
const ETIQUETAS_RECURSOS: Record<string, string> = {
  IMAGENES: 'Imágenes',
  LOGOS: 'Logo',
  DOCUMENTACION: 'Documentación',
  VIDEOS: 'Vídeos',
};

function toGrupoRecursos(ambito: string, grupo: GrupoRecursosBeanAPI): GrupoRecursos {
  const recursos: Recurso[] = Object.values(grupo.recursos ?? {})
    .filter((r) => r.url)
    .map((r) => ({
      tipo: tipoRecurso(ambito),
      nombre: r.nombre ?? undefined,
      url: absolutizar(r.url as string),
      titulo: r.titulo ?? undefined,
      etiqueta: r.etiqueta ?? undefined,
      thumbnail: r.thumbnail ? absolutizar(r.thumbnail) : undefined,
    }));
  return {
    ambito: ambito.toLowerCase(),
    etiqueta: ETIQUETAS_RECURSOS[ambito] ?? etiquetaDesdeNombre(ambito),
    recursos,
  };
}

/** Documentos del centro: un solo listado a partir de las DOS fuentes que la API manda
 *  por separado (ver `DocumentoCentro` en el modelo de dominio para el porqué). */
function extraerDocumentacion(raw: CentroBeanAPI, gruposCaracteristicas: GrupoCaracteristicas[]): DocumentoCentro[] {
  const descripciones = new Map<string, string>();
  const grupoDoc = gruposCaracteristicas.find((g) => g.ambito === 'documentacion');
  for (const c of grupoDoc?.caracteristicas ?? []) {
    const clave = c.nombre.replace(/^DESCRIPCION-/, '');
    const texto = String(c.valor).trim();
    if (texto) descripciones.set(clave, texto);
  }

  const documentos: DocumentoCentro[] = Object.values(raw.recursos?.['DOCUMENTACION']?.recursos ?? {})
    .filter((r) => r.url)
    .map((r) => {
      const clave = r.nombre;
      const descripcion = descripciones.get(clave);
      descripciones.delete(clave);
      return {
        clave,
        etiqueta: r.etiqueta ?? r.titulo ?? etiquetaDesdeNombre(clave),
        url: absolutizar(r.url as string),
        descripcion,
      };
    });

  for (const [clave, descripcion] of descripciones) {
    documentos.push({ clave, etiqueta: etiquetaDesdeNombre(clave), descripcion });
  }
  return documentos;
}

export function toCentro(raw: CentroBeanAPI): Centro {
  const dg = raw.datosGenerales;

  const grupos: GrupoCaracteristicas[] = Object.entries(raw.caracteristicas ?? {})
    .sort(([a], [b]) => {
      const ia = ORDEN_AMBITOS.indexOf(a);
      const ib = ORDEN_AMBITOS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([ambito, grupo]) => {
      const caracteristicas = (grupo.caracteristicas ?? [])
        .map(toCaracteristica)
        .filter((c): c is Caracteristica => c !== null);
      return {
        ambito: ambito.toLowerCase(),
        etiqueta: ETIQUETAS_AMBITOS[ambito] ?? grupo.etiqueta,
        caracteristicas: ambito === 'CERTIFICADOS' ? filtrarCertificacionesEnNo(caracteristicas) : caracteristicas,
      };
    });

  const documentacion = extraerDocumentacion(raw, grupos);
  /**
   * ORDEN CRÍTICO (defecto real, encontrado el 2026-08-14 al escribir su prueba):
   * `extraerPrecios` va ANTES de descartar las claves ocultas, porque
   * `MOSTRAR-PRECIOS-EN-FICHA` es justamente una de ellas. Al revés, `mostrarEnFicha`
   * salía SIEMPRE false. Verificado contra la ficha 9106 (precios reales, 3.072,73 €).
   */
  const precios = extraerPrecios(grupos);
  for (const g of grupos) {
    g.caracteristicas = g.caracteristicas.filter((c) => !CLAVES_OCULTAS.has(c.nombre));
  }

  const plazas = grupos.flatMap((g) => g.caracteristicas).find((c) => c.nombre === 'PLAZAS-TOTALES');

  const lat = dg.geoLat ? parseFloat(dg.geoLat) : NaN;
  const lng = dg.geoLong ? parseFloat(dg.geoLong) : NaN;

  return {
    id: raw.id,
    slug: slugify(dg.nombre),
    nombre: dg.nombre,
    tipologia: raw.nombreTipologia ?? 'Centro',
    tipologiaCod: dg.tipologia,
    tipologiaRuta: rutaFichaDeCod(dg.tipologia),
    grupo: raw.nombreGrupo?.trim() || undefined,
    esMiembro: raw.miembro,
    /**
     * UN 0 NO ES UN ÍNDICE: ES QUE NO LO TENEMOS (PM, 2026-08-13: "quitamos el 0%").
     * La API devuelve `valorTransparencia = 0` para todo lo que no es residencia porque
     * el índice sencillamente no se calcula ahí; publicar "0% · Sin datos" se lee como
     * un suspenso cuando es un hueco NUESTRO. Se descarta a nivel de ADAPTADOR para que
     * ningún consumidor futuro pueda volver a publicarlo.
     */
    transparencia:
      raw.valorTransparencia != null && raw.valorTransparencia > 0
        ? {
            indice: raw.valorTransparencia,
            razon: raw.relacionTransparencia ?? undefined,
            tramo: tramoTransparencia(raw.valorTransparencia),
          }
        : undefined,
    contacto: {
      direccion: dg.direccion ?? undefined,
      codigoPostal: dg.cp ?? undefined,
      poblacion: {
        id: raw.poblacion.id,
        nombre: raw.poblacion.poblacion,
        comarca: raw.poblacion.comarca ?? undefined,
        provincia: raw.poblacion.provincia,
        comunidad: raw.poblacion.comunidad,
      },
      telefono: dg.telefono ?? undefined,
      web: dg.web ?? undefined,
    },
    geo: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
    eslogan: dg.eslogan ?? undefined,
    // seoDescriptionExt (HTML del CMS) y porqueElegimos son bloques DISTINTOS y pueden
    // coexistir (validado con ficha 9106).
    descripcionHtml: dg.seoDescriptionExt ?? undefined,
    porqueElegimos: dg.porqueElegimos?.trim() || undefined,
    titular: dg.titular?.trim() || undefined,
    registro: dg.registro ?? undefined,
    plazasTotales: typeof plazas?.valor === 'number' ? plazas.valor : undefined,
    precios,
    // El ámbito DOCUMENTACION sale de aquí: sus textos ya viven, junto a su PDF, en
    // `documentacion`. Un grupo que se queda sin filas no debe dejar un <h2> huérfano.
    caracteristicas: grupos.filter((g) => g.ambito !== 'documentacion' && g.caracteristicas.length > 0),
    documentacion,
    // DOCUMENTACION tampoco se queda en `recursos`: fuente única (PM, 2026-08-14).
    recursos: Object.entries(raw.recursos ?? {})
      .filter(([ambito]) => ambito !== 'DOCUMENTACION')
      .map(([ambito, grupo]) => toGrupoRecursos(ambito, grupo))
      .filter((g) => g.recursos.length > 0),
    fechaActualizacion: dg.fechaActualizacion ?? undefined,
  };
  // Campos que NUNCA se propagan (docs/11): nif, email, emailAdministrativo,
  // personaContacto, observaciones, fax, peso, clientePremium, fechas de promoción…
}

export async function getCentro(id: number): Promise<Centro | null> {
  const raw = await getCentroRaw(id);
  return raw ? toCentro(raw) : null;
}

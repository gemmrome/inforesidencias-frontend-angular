import '../server-only';

import { TIPOLOGIAS_RUTA } from '../../app/shared/indice/tipos';
import { sugerirZonas, zonaDeCodigoPostal } from '../indice/sugerencias';
import { FACETAS_FILTRO } from '../../app/shared/buscador/filtros';

/**
 * CAPA 1 del buscador — interpretación DETERMINISTA de la consulta (sin IA). Portado
 * LITERAL de src/lib/buscador/parser.ts. Convierte lenguaje libre en filtros
 * estructurados + la URL de listado que ya existe. Cero latencia, cero coste,
 * resultado reproducible; la IA (capa 2, `interprete-ia.ts`) solo entra si esto no
 * resuelve nada. Es server-only porque depende del índice geográfico
 * (`sugerirZonas`/`zonaDeCodigoPostal`) para validar zonas — nunca se inventan.
 */

export interface ConsultaInterpretada {
  tipologia?: string;
  geo?: string;
  zonaNombre?: string;
  facetas: string[];
  precioMax?: number;
  /** Texto que no se ha podido interpretar (posible nombre de centro). */
  resto: string;
  /** URL de listado equivalente, o null si no hay nada accionable. */
  url: string | null;
  /** Qué capa lo resolvió — para medir cuánto necesita realmente la IA. */
  capa: 'reglas' | 'ia';
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SINONIMOS_TIPOLOGIA: { patron: RegExp; slug: string }[] = [
  { patron: /\b(centros? de d[ií]a|centro-dia)\b/, slug: 'centros-de-dia-para-mayores' },
  { patron: /\b(ayuda a domicilio|atenci[oó]n domiciliaria|sad|domicilio)\b/, slug: 'servicio-de-atencion-domiciliaria' },
  { patron: /\b(teleasistencia|teleasistente)\b/, slug: 'teleasistencia' },
  {
    patron: /\b(apartamentos?( con servicios| tutelados?| para mayores)?|viviendas? tutelad[ao]s?|senior living)\b/,
    slug: 'apartamentos-con-servicios',
  },
  { patron: /\b(residencias?|geri[aá]trico|asilo|centro de mayores)\b/, slug: 'residencias' },
];

const SINONIMOS_FACETA: { patron: RegExp; clave: string }[] = [
  { patron: /\b(alzh[eé]imer|demencia|deterioro cognitivo|unidad de demencia)\b/, clave: 'unidad-demencia' },
  { patron: /\b(sin sujeci[oó]n(es)?|sin contenciones|libre de sujeciones)\b/, clave: 'sin-sujeciones' },
  { patron: /\b(concertad[ao]s?|plaza p[uú]blica|plazas p[uú]blicas|p[uú]blica)\b/, clave: 'concertada' },
  { patron: /\b(m[eé]dico)\b/, clave: 'medico-propio' },
  { patron: /\b(enfermer[ií]a|enfermer[ao])\b/, clave: 'enfermeria-propia' },
  { patron: /\b(silla de ruedas|movilidad reducida)\b/, clave: 'silla-ruedas' },
  { patron: /\b(encamad[ao]s?|encamamiento)\b/, clave: 'encamados' },
  { patron: /\b(ley de dependencia|acreditad[ao]s?|dependencia)\b/, clave: 'acreditada-dependencia' },
  { patron: /\b(certificad[ao] de calidad|iso|calidad certificada)\b/, clave: 'certificado-calidad' },
];

/** "por menos de 2.000 euros", "hasta 1800€", "presupuesto 2500" → 2000/1800/2500 */
function extraerPrecio(texto: string): number | undefined {
  const m = texto.match(
    /(?:menos de|hasta|m[aá]ximo|max|por debajo de|presupuesto (?:de )?)\s*([1-9]\d{0,2}(?:[.\s]\d{3})+|[1-9]\d{2,5})/,
  );
  if (!m) return undefined;
  const n = Number(m[1].replace(/[.\s]/g, ''));
  return n >= 300 && n <= 10000 ? n : undefined;
}

/** ¿`frase` es el nombre completo de la zona o un prefijo suyo terminado en palabra entera? */
function esPrefijoDePalabras(nombre: string, frase: string): boolean {
  if (nombre === frase) return true;
  return nombre.startsWith(frase) && /[\s-]/.test(nombre.charAt(frase.length));
}

/** Palabras que nunca son nombre de centro ni zona (evita ruido en el resto). */
const VACIAS = new Set([
  'en', 'de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'sin', 'por', 'una', 'un',
  'mi', 'madre', 'padre', 'abuela', 'abuelo', 'familiar', 'que', 'y', 'o', 'cerca',
  'busco', 'buscar', 'quiero', 'necesito', 'residencia', 'residencias', 'centro', 'centros',
  'euros', 'eur', 'mes', 'al', 'menos', 'hasta', 'maximo', 'mas', 'barata', 'barato',
]);

export function interpretarConsulta(consulta: string): ConsultaInterpretada {
  const original = consulta.trim();
  const texto = norm(original);

  const facetas = SINONIMOS_FACETA.filter((f) => f.patron.test(texto)).map((f) => f.clave);
  const validas = new Set(FACETAS_FILTRO.map((f) => f.clave));
  const facetasOk = [...new Set(facetas)].filter((f) => validas.has(f));

  const tipologia = SINONIMOS_TIPOLOGIA.find((t) => t.patron.test(texto))?.slug;
  const precioMax = extraerPrecio(texto);

  let geo: string | undefined;
  let zonaNombre: string | undefined;
  const cp = original.match(/\b(\d{5})\b/)?.[1];
  if (cp) {
    const z = zonaDeCodigoPostal(cp);
    if (z) {
      geo = z.segmentos;
      zonaNombre = z.nombre;
    }
  }
  if (!geo) {
    const palabras = texto
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((p) => p && !VACIAS.has(p) && !/^\d+$/.test(p));
    for (let largo = Math.min(4, palabras.length); largo >= 1 && !geo; largo--) {
      for (let i = 0; i + largo <= palabras.length; i++) {
        const frase = palabras.slice(i, i + largo).join(' ');
        if (frase.length < 3) continue;
        const [mejor] = sugerirZonas(frase, 1);
        if (mejor && esPrefijoDePalabras(norm(mejor.nombre), frase)) {
          geo = mejor.segmentos;
          zonaNombre = mejor.nombre;
          break;
        }
      }
    }
  }

  const resto = texto
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p && !VACIAS.has(p) && (!zonaNombre || !norm(zonaNombre).includes(p)))
    .join(' ');

  const rutaTipologia = tipologia ?? 'residencias';
  let url: string | null = null;
  if (geo || facetasOk.length || precioMax !== undefined) {
    const params = new URLSearchParams();
    if (facetasOk.length) params.set('f', facetasOk.join(','));
    if (precioMax !== undefined) params.set('precioMax', String(precioMax));
    const q = params.toString();
    url = `/centros/buscador/${rutaTipologia}${geo ? `/${geo}` : ''}${q ? `?${q}` : ''}`;
  }

  return {
    ...(tipologia && { tipologia }),
    ...(geo && { geo }),
    ...(zonaNombre && { zonaNombre }),
    facetas: facetasOk,
    ...(precioMax !== undefined && { precioMax }),
    resto,
    url,
    capa: 'reglas',
  };
}

/** ¿La interpretación por reglas ha sacado algo útil? */
export function esUtil(r: ConsultaInterpretada): boolean {
  return Boolean(r.geo) || r.facetas.length > 0 || r.precioMax !== undefined;
}

/** Slugs de tipología válidos (para validar lo que devuelva la capa 2). */
export const TIPOLOGIAS_VALIDAS = Object.keys(TIPOLOGIAS_RUTA);

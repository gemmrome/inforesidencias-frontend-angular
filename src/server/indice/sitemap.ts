import '../server-only';

import { listar, metaIndice } from './store';
import { zonasParaSitemap, centrosDeZona, todasLasProvincias, slugGeo } from './geo';
import { preciosPorSubzona, estadisticasDeZona, centrosConFaceta } from './estadisticas';
import { TIPOLOGIAS_RUTA } from '../../app/shared/indice/tipos';
import { FAMILIAS_LISTADO } from '../../app/shared/listados/config';

/**
 * Generación de sitemaps por familia (docs/03 §6.10). Portado literal de
 * src/lib/indice/sitemap.ts. Reglas INV-04: solo URLs canónicas que responden 200.
 *
 * DIFERENCIA CON EL ORIGINAL: `xmlDeFamilia` usaba `"use cache" + cacheLife("days") +
 * cacheTag("indice")`. Aquí se cachea con un Map en memoria de proceso con TTL de un
 * día — mismo criterio (es el trabajo más caro del clon y lo pide Googlebot, no un
 * humano), sin el mecanismo específico de Next.
 */

export const FAMILIAS_SITEMAP = [
  'portada',
  'directorio-hub',
  'fichas-residencia',
  'fichas-centro-de-dia-para-mayores',
  'fichas-servicio-de-atencion-domiciliaria',
  'fichas-teleasistencia',
  'fichas-apartamentos-con-servicios',
  'geograficas-residencias',
  'geograficas-centros-de-dia-para-mayores',
  'geograficas-servicio-de-atencion-domiciliaria',
  'geograficas-teleasistencia',
  'geograficas-apartamentos-con-servicios',
  'geograficas-directorio',
  'precios-residencias',
  'residencias-mas-transparentes',
  ...Object.keys(FAMILIAS_LISTADO),
] as const;

export function urlsDeFamilia(familia: string): string[] | null {
  if (familia === 'portada') {
    return ['/'];
  }
  if (familia === 'directorio-hub') {
    const urls = new Set<string>(['/centros/directorio']);
    for (const { slug, ref } of todasLasProvincias()) {
      urls.add(`/centros/directorio/${slugGeo(ref.comunidad)}`);
      urls.add(`/centros/directorio/${slugGeo(ref.comunidad)}/${slug}`);
    }
    return [...urls].sort();
  }
  if (familia === 'precios-residencias') {
    const provincias = preciosPorSubzona({ nivel: 'nacional' }, 1)
      .filter((p) => p.conPrecio >= 3)
      .map((p) => `/precios-residencias/${p.slug}`)
      .sort();
    return ['/precios-residencias', ...provincias];
  }
  if (familia === 'residencias-mas-transparentes') {
    const provincias = todasLasProvincias()
      .filter((p) => estadisticasDeZona(p.ref, 1).centrosConTransparencia >= 5)
      .map((p) => `/residencias-mas-transparentes/${p.slug}`)
      .sort();
    return ['/residencias-mas-transparentes', ...provincias];
  }
  if (familia in FAMILIAS_LISTADO) {
    const faceta = FAMILIAS_LISTADO[familia].faceta;
    const provincias = todasLasProvincias()
      .filter((p) => centrosConFaceta(p.ref, 1, faceta).length >= 5)
      .map((p) => `/${familia}/${p.slug}`)
      .sort();
    return [`/${familia}`, ...provincias];
  }
  if (familia.startsWith('fichas-')) {
    const segmento = familia.slice('fichas-'.length);
    const rutas = new Set<string>();
    for (const d of listar()) {
      const ruta = new URL(d.url).pathname;
      if (ruta.startsWith(`/centros/${segmento}/`)) rutas.add(ruta);
    }
    return rutas.size ? [...rutas].sort() : null;
  }
  if (familia.startsWith('geograficas-')) {
    const tipologia = familia.slice('geograficas-'.length);
    const tipo = TIPOLOGIAS_RUTA[tipologia];
    if (!tipo) return null;
    return zonasParaSitemap()
      .filter(({ ref }) => centrosDeZona(ref, tipo.cod).length > 0)
      .map(({ ruta }) => `/centros/buscador/${tipologia}${ruta}`);
  }
  return null;
}

interface EntradaCache {
  expira: number;
  valor: string | null;
}
const CACHE_UN_DIA = 1000 * 60 * 60 * 24;
const cache = new Map<string, EntradaCache>();

/** Sitemap de una familia, CACHEADO y etiquetado. */
export async function xmlDeFamilia(familia: string, site: string): Promise<string | null> {
  const clave = `${familia}|${site}`;
  const enCache = cache.get(clave);
  if (enCache && enCache.expira > Date.now()) return enCache.valor;
  const urls = urlsDeFamilia(familia);
  const valor = urls ? xmlDeUrls(urls, site) : null;
  cache.set(clave, { expira: Date.now() + CACHE_UN_DIA, valor });
  return valor;
}

/** Vacía la caché de sitemaps. La llama la ruta `/api/interno/revalidar` tras una sync,
 *  para no esperar hasta un día a que el sitemap recoja centros nuevos. */
export function invalidarCacheSitemap(): void {
  cache.clear();
}

export function xmlDeUrls(urls: string[], site: string): string {
  const lastmod = metaIndice().generado;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${site}${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`
  );
}

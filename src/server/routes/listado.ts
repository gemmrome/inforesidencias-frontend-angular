import { Router } from 'express';

import { metaIndice, pasaFiltro } from '../indice/store';
import {
  centrosDeZona,
  nivelSuperior,
  nombreZona,
  refSubzona,
  resolverGeo,
  rutaGeo,
  sePuedeOrdenarPorFecha,
  slugGeo,
  subzonas,
  tipologiasEnZona,
} from '../indice/geo';
import { centrosConFaceta, estadisticasDeZona, faqsDeZona } from '../indice/estadisticas';
import { resumenDeMapa } from '../../app/shared/buscador/puntos-mapa';
import { aFiltroIndice, aQuery, datosPanel, leerFiltros } from '../../app/shared/buscador/filtros';
import { FAMILIAS_LISTADO } from '../../app/shared/listados/config';
import { TIPOLOGIAS_RUTA } from '../../app/shared/indice/tipos';
import type { GeoRef, OrdenListado } from '../../app/shared/indice/tipos';

/**
 * `GET /api/v1/listado` — portado de la página de servidor
 * src/app/(sitio)/centros/buscador/[tipologia]/[[...geo]]/page.tsx (694 líneas).
 *
 * DIFERENCIA ARQUITECTÓNICA DELIBERADA con el original: allí toda esta lógica corría
 * dentro de un Server Component, que a la vez calculaba los datos Y los renderizaba a
 * HTML en el mismo paso. Angular no tiene Server Components: sus componentes son
 * isomorfos (corren igual en servidor y en navegador) y NO pueden importar nada de
 * `src/server/` (esa frontera la marca `server-only.ts`, igual que aquí lo hacía
 * `import "server-only"`). Así que este endpoint hace exactamente el mismo cálculo que
 * hacía la función `contenidoDe()` del original — reutilizando literalmente las mismas
 * funciones de `indice/`, `estadisticas/` y `buscador/filtros` ya portadas — y lo sirve
 * como JSON; el componente Angular de la página (`ListadoPageComponent`) hace de
 * `Resultados`: pide este JSON (con `HttpClient`, que funciona igual en SSR y en
 * cliente) y solo se encarga de pintarlo.
 *
 * PENDIENTE (no portado, fuera del alcance de la migración de lib/ acordada):
 * `SlotPatrocinio`/`ResultadoPatrocinado` (anuncios) y `generateMetadata`/JSON-LD por
 * ruta — eso último es la tarea 9 (SEO), que se resuelve con los servicios `Meta`/
 * `Title` de Angular directamente en `ListadoPageComponent`, no aquí.
 */
export const listadoRoute = Router();

// Mismo criterio que `apiV1` (docs/03 §6.11, COMP-01): todo lo que cuelga de /api/
// lleva SIEMPRE X-Robots-Tag: noindex, indexable o no el resto del sitio.
listadoRoute.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

const POR_PAGINA = 20;

function segmentosDe(geo: string): string[] {
  return geo
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

listadoRoute.get('/listado', (req, res) => {
  const rutaTipologia = String(req.query['tipologia'] ?? '');
  const tipo = TIPOLOGIAS_RUTA[rutaTipologia];
  if (!tipo) {
    res.status(400).json({ error: `tipologia desconocida; valores: ${Object.keys(TIPOLOGIAS_RUTA).join(', ')}.` });
    return;
  }

  const geoQuery = String(req.query['geo'] ?? '');
  const segmentos = segmentosDe(geoQuery);
  let ref: GeoRef | null = resolverGeo(segmentos);

  if (!ref) {
    // Mismo fallback que `contextoDe()` en el original: slug de 3 niveles con provincia
    // válida pero comarca/población desconocida → redirección permanente al nivel
    // provincia, en vez de un 404 duro.
    if (segmentos.length === 3) {
      const provinciaRef = resolverGeo(segmentos.slice(0, 2));
      if (provinciaRef) {
        res.json({
          encontrado: false,
          redirect: `/centros/buscador/${rutaTipologia}${rutaGeo(provinciaRef)}`,
        });
        return;
      }
    }
    // 200 (no 404): la ausencia de zona es un resultado de datos válido de este
    // contrato JSON, no un fallo de la petición HTTP — así `ListadoPageComponent` lo
    // recibe como valor normal en vez de como error de `HttpClient` y puede pintar un
    // "no encontrado" en vez de quedarse colgado esperando una respuesta que nunca
    // llegará a su `switchMap` (un 404 real haría que `HttpClient` lance en vez de
    // emitir). `/api/v1/*` sí usa 4xx reales para peticiones mal formadas (p. ej. la
    // tipología desconocida de arriba), que no es el caso de una zona inexistente.
    res.json({ encontrado: false });
    return;
  }

  const facetasCrudo = String(req.query['f'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const crudos: Record<string, string | string[]> = {};
  for (const [clave, valor] of Object.entries(req.query)) {
    if (typeof valor === 'string') crudos[clave] = valor;
    else if (Array.isArray(valor)) crudos[clave] = valor.map(String);
  }
  const filtros = leerFiltros(crudos);
  void facetasCrudo; // leerFiltros ya lee `f` de `crudos`; se deja explícito por claridad.

  const ordenParam = req.query['orden'];
  const orden: OrdenListado = ordenParam === 'actualizacion' ? 'actualizacion' : 'transparencia';
  const paginaPedida = Math.max(1, Number(req.query['page']) || 1);

  const fi = aFiltroIndice(filtros);
  // Candidatos = zona SIN filtrar (para los contadores del panel); centros = filtrados.
  const candidatos = centrosDeZona(ref, tipo.cod, orden);
  const centros =
    fi.facetas || fi.precioMin !== undefined || fi.precioMax !== undefined
      ? candidatos.filter((c) => pasaFiltro(c, fi))
      : candidatos;

  const totalPaginas = Math.max(1, Math.ceil(centros.length / POR_PAGINA));
  const pagina = Math.min(paginaPedida, totalPaginas);
  const visibles = centros.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const sub = subzonas(ref, tipo.cod);
  const zona = nombreZona(ref);
  const base = `/centros/buscador/${rutaTipologia}${rutaGeo(ref)}`;

  const queryFiltros = aQuery(filtros).replace(/^\?/, '');
  const resumenMapa = resumenDeMapa(
    centros,
    `/api/v1/centros/mapa?tipologia=${encodeURIComponent(rutaTipologia)}` +
      `&geo=${encodeURIComponent(rutaGeo(ref).replace(/^\//, ''))}` +
      (queryFiltros ? `&${queryFiltros}` : ''),
  );

  const estadisticas = estadisticasDeZona(ref, tipo.cod);
  const panel = datosPanel(candidatos);
  const fechaSync = metaIndice().generado;
  // Capa editorial y FAQs solo en la primera página (las paginadas canonicalizan a la base).
  const faqs = pagina === 1 ? faqsDeZona(estadisticas, tipo.corto, zona.enFrase) : [];

  const listadosProvincia =
    ref.nivel === 'provincia'
      ? Object.entries(FAMILIAS_LISTADO)
          .filter(([, f]) => centrosConFaceta(ref!, 1, f.faceta).length >= 5)
          .map(([slug, f]) => ({ slug, corto: f.fraseCorta, provinciaSlug: slugGeo(ref!.provincia) }))
      : [];

  const etiquetaSub =
    ref.nivel === 'nacional' ? 'Comunidades' : ref.nivel === 'ccaa' ? 'Provincias' : ref.nivel === 'provincia' ? 'Comarcas' : 'Municipios';

  const superior = nivelSuperior(ref);

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json({
    encontrado: true,
    ctx: {
      rutaTipologia,
      tipoCod: tipo.cod,
      tipoPlural: tipo.plural,
      tipoCorto: tipo.corto,
      nivel: ref.nivel,
      provincia: 'provincia' in ref ? ref.provincia : null,
      zonaCorto: zona.corto,
      zonaEnFrase: zona.enFrase,
      canonicalSuperior: superior ? `/centros/buscador/${rutaTipologia}${rutaGeo(superior)}` : null,
    },
    base,
    filtros,
    orden,
    puedeOrdenarPorFecha: sePuedeOrdenarPorFecha(candidatos),
    centrosTotal: centros.length,
    candidatosTotal: candidatos.length,
    pagina,
    totalPaginas,
    porPagina: POR_PAGINA,
    visibles,
    panel,
    resumenMapa,
    estadisticas,
    faqs,
    subzonas: sub.map((s) => ({ ...s, href: (() => {
      const hija = refSubzona(ref!, s.nombre);
      return hija ? `/centros/buscador/${rutaTipologia}${rutaGeo(hija)}` : base;
    })() })),
    etiquetaSub,
    tipologiasEnZona: tipologiasEnZona(ref).map((t) => ({ ...t, href: `/centros/buscador/${t.ruta}${rutaGeo(ref!)}` })),
    listadosProvincia,
    fechaSync,
  });
});

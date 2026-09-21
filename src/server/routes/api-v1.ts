import { Router } from 'express';

import { buscar, metaIndice, pasaFiltro } from '../indice/store';
import { resolverGeo, centrosDeZona, todasLasProvincias, comarcasDeProvincia, slugGeo } from '../indice/geo';
import { sugerirZonas, zonaDeCodigoPostal, type SugerenciaZona } from '../indice/sugerencias';
import { interpretar } from '../buscador/interprete-ia';
import { leerFiltros, aFiltroIndice } from '../../app/shared/buscador/filtros';
import { puntosDeMapa } from '../../app/shared/buscador/puntos-mapa';
import { TIPOLOGIAS_RUTA, type DocIndice } from '../../app/shared/indice/tipos';

/**
 * `/api/v1/*` — el contrato público v1 (docs/10, "AI-First"): entrada por query params,
 * salida JSON documentada, sin estado y sin lógica de UI, para que lo consuma tanto el
 * buscador de la web como un agente/integración externa tal cual.
 *
 * Portado de src/app/api/v1/**\/route.ts. La única traducción real de Next a Express es
 * mecánica: `NextRequest`/`NextResponse` → `req`/`res` de Express, y los `params`
 * dinámicos de Next → `req.params` de Express. La lógica de cada endpoint (qué valida,
 * qué cabeceras pone, qué forma tiene la respuesta) es LITERAL.
 */
export const apiV1 = Router();

// Todo lo que cuelga de /api/ lleva SIEMPRE X-Robots-Tag: noindex (COMP-01: en
// producción los endpoints de datos acabaron indexados en Google).
apiV1.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

interface ResultadoBusqueda {
  centroId: number;
  nombre: string;
  tipologia: string;
  poblacion: string;
  provincia: string;
  plazas: number | null;
  precioDesde: number | null;
  transparencia: number | null;
  ruta: string;
}

function aResultado(d: DocIndice): ResultadoBusqueda {
  return {
    centroId: d.centroId,
    nombre: d.nombre,
    tipologia: d.tipologia,
    poblacion: d.poblacion,
    provincia: d.provincia,
    plazas: d.plazas,
    precioDesde: d.precioDesde,
    transparencia: d.transparencia,
    ruta: new URL(d.url).pathname,
  };
}

/**
 * GET /api/v1/centros/buscar — q (obligatorio, ≥2 car.), tipologia, provincia, limite (1-50).
 */
apiV1.get('/centros/buscar', (req, res) => {
  const q = String(req.query['q'] ?? '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Parámetro q obligatorio (mínimo 2 caracteres).' });
    return;
  }
  const tipologiaSlug = typeof req.query['tipologia'] === 'string' ? req.query['tipologia'] : undefined;
  if (tipologiaSlug && !(tipologiaSlug in TIPOLOGIAS_RUTA)) {
    res.status(400).json({ error: `tipologia desconocida; valores: ${Object.keys(TIPOLOGIAS_RUTA).join(', ')}.` });
    return;
  }
  const cod = tipologiaSlug ? TIPOLOGIAS_RUTA[tipologiaSlug].cod : undefined;
  const provincia = typeof req.query['provincia'] === 'string' ? req.query['provincia'] : undefined;
  const limite = Math.min(Math.max(1, Number(req.query['limite']) || 10), 50);

  const resultados = buscar(
    q,
    { ...(cod != null && { codTipologia: cod }), ...(provincia && { provincia }) },
    limite,
  ).map(aResultado);

  // Zonas: el usuario suele buscar un SITIO, no un centro. Un CP exacto resuelve directo.
  const esCP = /^\d{5}$/.test(q);
  const zonas: SugerenciaZona[] = esCP
    ? [zonaDeCodigoPostal(q)].filter((z): z is SugerenciaZona => z !== null)
    : sugerirZonas(q);
  const rutaTipologia = tipologiaSlug ?? 'residencias';

  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').json({
    consulta: q,
    total: resultados.length,
    indiceActualizado: metaIndice().generado,
    zonas: zonas.map((z) => ({ ...z, ruta: `/centros/buscador/${rutaTipologia}/${z.segmentos}` })),
    resultados,
  });
});

/** GET /api/v1/centros/interpretar — lenguaje natural → filtros + URL de listado. */
apiV1.get('/centros/interpretar', async (req, res) => {
  const q = String(req.query['q'] ?? '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Parámetro q obligatorio (mínimo 2 caracteres).' });
    return;
  }
  const r = await interpretar(q);
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json({
    consulta: q,
    capa: r.capa,
    interpretacion: {
      tipologia: r.tipologia ?? null,
      zona: r.zonaNombre ?? null,
      geo: r.geo ?? null,
      facetas: r.facetas,
      precioMax: r.precioMax ?? null,
      resto: r.resto,
    },
    url: r.url,
    indiceActualizado: metaIndice().generado,
  });
});

/** GET /api/v1/centros/mapa — puntos del mapa de resultados, BAJO DEMANDA (docs/24 §G3). */
apiV1.get('/centros/mapa', (req, res) => {
  const tipologia = String(req.query['tipologia'] ?? '');
  const tipo = TIPOLOGIAS_RUTA[tipologia];
  if (!tipo) {
    res.status(400).json({ error: `tipologia desconocida; valores: ${Object.keys(TIPOLOGIAS_RUTA).join(', ')}.` });
    return;
  }

  const segmentos = String(req.query['geo'] ?? '')
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const ref = resolverGeo(segmentos);
  if (!ref) {
    res.status(404).json({ error: 'zona geográfica desconocida.' });
    return;
  }

  // Mismos filtros que la página: se le pasan los parámetros crudos a `leerFiltros`
  // para que la regla de filtrado exista en un solo sitio (docs/23 §B-6).
  const crudos: Record<string, string | string[]> = {};
  for (const [clave, valor] of Object.entries(req.query)) {
    if (typeof valor === 'string') crudos[clave] = valor;
    else if (Array.isArray(valor)) crudos[clave] = valor.map(String);
  }
  const fi = aFiltroIndice(leerFiltros(crudos));

  const candidatos = centrosDeZona(ref, tipo.cod);
  const centros =
    fi.facetas || fi.precioMin !== undefined || fi.precioMax !== undefined
      ? candidatos.filter((c) => pasaFiltro(c, fi))
      : candidatos;

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400').json(puntosDeMapa(centros));
});

/** GET /api/v1/geografia — sin params: provincias. Con ?provincia=: sus comarcas. */
apiV1.get('/geografia', (req, res) => {
  const provincia = typeof req.query['provincia'] === 'string' ? req.query['provincia'] : undefined;
  res.set('Cache-Control', 'public, max-age=3600');
  if (provincia) {
    res.json({ provincia, comarcas: comarcasDeProvincia(slugGeo(provincia)) });
    return;
  }
  res.json({ provincias: todasLasProvincias().map((p) => p.ref.provincia) });
});

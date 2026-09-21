import { Router } from 'express';

import { listar, metaIndice } from '../indice/store';
import { rankingTransparencia } from '../indice/estadisticas';
import { slugGeo } from '../indice/geo';
import { ANIO_INICIO_AYUDA, anosAyudando } from '../config/marca';
import { FAMILIAS_LISTADO } from '../../app/shared/listados/config';
import { TIPOLOGIAS_RUTA } from '../../app/shared/indice/tipos';

/**
 * `GET /api/v1/home` — datos de la home. Portado de la función `contenidoHome()` de
 * src/app/(sitio)/page.tsx (Server Component original): mismo cálculo, servido como
 * JSON en vez de HTML ya renderizado — ver la nota de arquitectura en
 * `routes/listado.ts`, que aplica igual aquí.
 */
export const homeRoute = Router();

homeRoute.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

homeRoute.get('/home', (_req, res) => {
  const docs = listar();
  const meta = metaIndice();
  const residencias = docs.filter((d) => d.codTipologia === 1);
  const conTransparencia = docs.filter((d) => d.transparencia !== null).length;

  const porCcaa = new Map<string, { nombre: string; n: number }>();
  const porProvincia = new Map<string, { nombre: string; ccaa: string; n: number }>();
  for (const d of residencias) {
    const sc = slugGeo(d.comunidad);
    const sp = slugGeo(d.provincia);
    const c = porCcaa.get(sc) ?? { nombre: d.comunidad, n: 0 };
    c.n++;
    porCcaa.set(sc, c);
    const p = porProvincia.get(sp) ?? { nombre: d.provincia, ccaa: sc, n: 0 };
    p.n++;
    porProvincia.set(sp, p);
  }
  const ccaaOrdenadas = [...porCcaa.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([slug, c]) => ({ slug, nombre: c.nombre, n: c.n }));
  const provinciasTop = [...porProvincia.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .map(([slug, p]) => ({ slug, nombre: p.nombre, ccaa: p.ccaa, n: p.n }));

  const topTransparentes = rankingTransparencia({ nivel: 'nacional' }, 1, 4);

  const tipologiasHome = Object.entries(TIPOLOGIAS_RUTA)
    .filter(([, t]) => t.cod !== null)
    .map(([slug, t]) => ({
      slug,
      nombre: t.plural,
      cod: t.cod as number,
      centros: meta.porTipologia[String(t.cod)] ?? docs.filter((d) => d.codTipologia === t.cod).length,
    }));

  const familiasListado = Object.entries(FAMILIAS_LISTADO).map(([slug, f]) => ({ slug, fraseCorta: f.fraseCorta }));

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json({
    totalDocs: meta.totalDocs,
    conTransparencia,
    generado: meta.generado,
    anioInicioAyuda: ANIO_INICIO_AYUDA,
    anosAyudando: anosAyudando(meta.generado),
    ccaaOrdenadas,
    provinciasTop,
    topTransparentes,
    tipologiasHome,
    familiasListado,
  });
});

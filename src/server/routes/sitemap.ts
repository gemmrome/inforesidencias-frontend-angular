import { Router } from 'express';

import { metaIndice } from '../indice/store';
import { FAMILIAS_SITEMAP, xmlDeFamilia } from '../indice/sitemap';

/**
 * `/sitemap.xml` y `/sitemaps/:familia.xml` — portado de src/app/sitemap.xml/route.ts y
 * src/app/sitemaps/[familia]/route.ts. Índice de sitemaps segmentado por familia
 * (docs/03 §6.10, INV-04): mejor diagnóstico en GSC y sitemap honesto — solo familias
 * con URLs 200 canónicas.
 */
export const sitemapRoutes = Router();

const SITE = process.env['SITE_URL'] ?? 'https://www.inforesidencias.com';

let cacheIndex: { expira: number; cuerpo: string } | null = null;
const CACHE_UN_DIA = 1000 * 60 * 60 * 24;

function cuerpoSitemapIndex(): string {
  if (cacheIndex && cacheIndex.expira > Date.now()) return cacheIndex.cuerpo;
  const lastmod = metaIndice().generado;
  const cuerpo =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    FAMILIAS_SITEMAP.map((f) => `  <sitemap><loc>${SITE}/sitemaps/${f}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`).join(
      '\n',
    ) +
    `\n</sitemapindex>\n`;
  cacheIndex = { expira: Date.now() + CACHE_UN_DIA, cuerpo };
  return cuerpo;
}

sitemapRoutes.get('/sitemap.xml', (_req, res) => {
  res.set('Content-Type', 'application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(cuerpoSitemapIndex());
});

sitemapRoutes.get('/sitemaps/:familia', async (req, res) => {
  const familia = req.params['familia'];
  if (!familia.endsWith('.xml')) {
    res.status(404).send('No encontrado');
    return;
  }
  const xml = await xmlDeFamilia(familia.slice(0, -'.xml'.length), SITE);
  if (!xml) {
    res.status(404).send('No encontrado');
    return;
  }
  res.set('Content-Type', 'application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(xml);
});

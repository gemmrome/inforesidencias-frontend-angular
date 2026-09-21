import { Router } from 'express';

import { ES_INDEXABLE } from '../config/entorno';

/**
 * `/robots.txt` — portado de src/app/robots.ts.
 * - /api/ fuera del índice (además responde X-Robots-Tag: noindex — COMP-01).
 * - Bots de IA bienvenidos explícitamente (GEO, docs/03 §11 y docs/10 AI-First).
 * - FUERA DE PRODUCCIÓN se cierra entero (2026-08-06): un clon con miles de fichas
 *   indexable competiría con el original como contenido duplicado.
 */
export const robotsRoute = Router();

const SITE = process.env['SITE_URL'] ?? 'https://www.inforesidencias.com';

robotsRoute.get('/robots.txt', (_req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');

  if (!ES_INDEXABLE) {
    res.send('User-agent: *\nDisallow: /\n');
    return;
  }

  const lineas = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
    '',
  ];
  res.send(lineas.join('\n'));
});

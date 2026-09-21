import './server/cargar-env';

import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { ES_INDEXABLE } from './server/config/entorno';
import { apiV1 } from './server/routes/api-v1';
import { listadoRoute } from './server/routes/listado';
import { homeRoute } from './server/routes/home';
import { fichaCentroApi, fichaCentroPaginas } from './server/routes/ficha-centro';
import { apiPuente } from './server/routes/api-puente';
import { apiInterno } from './server/routes/api-interno';
import { sitemapRoutes } from './server/routes/sitemap';
import { robotsRoute } from './server/routes/robots';

/**
 * Servidor Express: motor de SSR de Angular + los mismos endpoints de servidor que en
 * el original vivían como Route Handlers de Next bajo `src/app/api/`, `src/app/
 * robots.ts` y `src/app/sitemap.xml/`. Es la pieza que no existía en el proyecto Next
 * (allí el "servidor" era el propio framework) y que aquí hace explícita la frontera
 * cliente/servidor que antes marcaba `import "server-only"`.
 *
 * Boilerplate de arranque (AngularNodeAppEngine / createNodeRequestHandler /
 * writeResponseToNodeResponse) es el patrón estándar del builder de aplicación de
 * Angular con SSR — no específico de este proyecto.
 *
 * IMPORTANTE — solo para producción: este fichero da por hecho que corre ya COMPILADO
 * dentro de `dist/<proyecto>/server/`, junto a `dist/<proyecto>/browser/` (de ahí el
 * cálculo de `browserDistFolder` de abajo). Ejecutarlo con `tsx` directamente sobre este
 * `.ts` (como hace `npm run dev`) sin haber hecho antes `ng build` rompe esa cuenta de
 * rutas: `browserDistFolder` apunta a una carpeta que no existe, así que
 * `express.static(...)` no sirve el CSS compilado (Tailwind incluido) ni el resto de
 * estáticos — la página renderiza con datos reales pero sin ningún estilo. Para
 * desarrollar en local usa siempre `ng serve` (ver MIGRACION.md § Cómo arrancarlo).
 */
const serverDistFolder = import.meta.dirname;
const browserDistFolder = join(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Cabecera X-Robots-Tag global (docs/03 §6.11, COMP-01). En el original la ponía
 * `next.config.ts` para TODA respuesta cuando `!ES_INDEXABLE`, además de que
 * `robots.txt` cerrara el rastreo — defensa en capas, porque `robots.txt` es una
 * petición educada y esta cabecera es la que de verdad vincula a Google y Bing.
 * Las rutas `/api/*` llevan además su propio `noindex` explícito SIEMPRE, indexable o
 * no el resto del sitio (ver los routers de abajo).
 */
app.use((_req, res, next) => {
  if (!ES_INDEXABLE) res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

// Los formularios de leads envían application/x-www-form-urlencoded, igual que en el
// original (allí Next los leía con `req.formData()`).
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// robots.txt y sitemaps ANTES del estático y de Angular.
app.use(robotsRoute);
app.use(sitemapRoutes);

// El contrato de servidor: /api/v1 (público), /api/puente (leads), /api/interno (revalidar).
app.use('/api/v1', apiV1);
app.use('/api/v1', listadoRoute);
app.use('/api/v1', homeRoute);
app.use('/api/v1', fichaCentroApi);
app.use('/api/puente', apiPuente);
app.use('/api/interno', apiInterno);

// Ficha de centro: 404/308 REALES antes que nada más pueda emitir un 200 (ver el
// comentario largo de src/server/routes/ficha-centro.ts). Deja pasar con `next()`
// cualquier URL que no tenga forma de ficha (incluida /centros/buscador/…).
app.use(fichaCentroPaginas);

// Ficheros estáticos del build del navegador.
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// Todo lo que no sea una de las rutas de arriba, lo renderiza Angular (SSR).
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Arranca el servidor Node solo cuando este fichero es el punto de entrada directo
 * (`node dist/.../server.mjs`), no cuando el builder de Angular lo importa para otros
 * fines (prerender, etc.) — mismo criterio que el `server.ts` por defecto del CLI.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Servidor Express (Angular SSR) escuchando en http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);

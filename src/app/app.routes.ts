import { Routes } from '@angular/router';

import { SiteShellComponent } from './layout/site-shell/site-shell.component';

/**
 * Árbol de rutas. Equivalente Angular del App Router de Next.js.
 *
 * `SiteShellComponent` (cabecera + `<router-outlet>` + pie) hace de padre para todas
 * las rutas normales del sitio — el mismo papel que cumplía el route group `(sitio)`
 * en el original. `particulares/buscamos-por-ti` cuelga FUERA de ese padre a propósito:
 * es la landing de búsqueda proactiva a pantalla completa, sin cabecera ni pie (ver
 * `SiteShellComponent` y `BuscamosPorTiPageComponent` para el porqué).
 *
 * `centros/buscador/:tipologia` es el listado geográfico (`ListadoPageComponent`).
 * Next usaba un catch-all opcional `[[...geo]]` para 0-3 segmentos de zona después de
 * la tipología; el Router de Angular no combina un comodín "resto de segmentos" con un
 * parámetro con nombre en la misma entrada de ruta (su `**` solo puede ser la ruta
 * entera), así que aquí van 4 entradas — sin geo, y con 1, 2 o 3 segmentos — que
 * apuntan todas al mismo componente. Éste reconstruye el array `geo` a partir de los
 * parámetros `g1`/`g2`/`g3` que existan (ver `ListadoPageComponent`).
 *
 * `centros/:tipo/:id/:slug` es la ficha de centro (`FichaCentroPageComponent`, tarea 6).
 * Su existencia y canonicidad (404/308 REALES) las resuelve `fichaCentroPaginas`
 * ANTES de que la petición llegue aquí (`src/server.ts`): cuando el Router de Angular
 * matchea esta ruta, la URL ya es la canónica de un centro que existe. La URL corta
 * `centros/:tipo/:id` (sin slug) NO tiene entrada aquí a propósito — esa ruta nunca
 * renderiza nada, solo redirige o da 404, y eso también lo resuelve Express antes de
 * llegar a Angular (igual que el original, que la resolvía sin pintar nada).
 *
 * NOTA DE MIGRACIÓN: falta el resto del árbol original — `/buscar`,
 * `/precios-residencias`, `/residencias-mas-transparentes`, el directorio y las
 * familias de listados por faceta (`/residencias-concertadas`, etc.) — tarea 8.
 */
export const routes: Routes = [
  {
    path: '',
    component: SiteShellComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomePageComponent),
        title: 'Inforesidencias — buscador de residencias',
      },
      {
        path: 'centros/buscador/:tipologia',
        loadComponent: () => import('./buscador/listado-page/listado-page.component').then((m) => m.ListadoPageComponent),
      },
      {
        path: 'centros/buscador/:tipologia/:g1',
        loadComponent: () => import('./buscador/listado-page/listado-page.component').then((m) => m.ListadoPageComponent),
      },
      {
        path: 'centros/buscador/:tipologia/:g1/:g2',
        loadComponent: () => import('./buscador/listado-page/listado-page.component').then((m) => m.ListadoPageComponent),
      },
      {
        path: 'centros/buscador/:tipologia/:g1/:g2/:g3',
        loadComponent: () => import('./buscador/listado-page/listado-page.component').then((m) => m.ListadoPageComponent),
      },
      {
        path: 'centros/:tipo/:id/:slug',
        loadComponent: () => import('./ficha-centro/ficha-centro-page/ficha-centro-page.component').then((m) => m.FichaCentroPageComponent),
      },
    ],
  },
  {
    path: 'particulares/buscamos-por-ti',
    loadComponent: () =>
      import('./pages/buscamos-por-ti/buscamos-por-ti.component').then((m) => m.BuscamosPorTiPageComponent),
    title: 'Cuéntanos qué necesitas — Inforesidencias',
  },
];

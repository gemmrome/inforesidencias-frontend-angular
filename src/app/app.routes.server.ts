import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Configuración de renderizado por ruta para el servidor (Angular 19+: "hybrid
 * rendering"). Sin este fichero, el build intenta PRE-renderizar en tiempo de
 * compilación cualquier ruta con parámetros (`:tipologia`, `:id`, `:slug`...) y falla
 * pidiendo `getPrerenderParams` — una función que enumeraría de antemano todos los
 * valores posibles de esos parámetros para generar una página estática por cada uno.
 *
 * Eso no tiene sentido aquí: ni el listado (`centros/buscador/...`) ni la ficha de
 * centro (`centros/:tipo/:id/:slug`) son contenido estático conocido en build — dependen
 * de datos que cambian con cada sincronización del índice (`sync:full`/`sync:incremental`)
 * o, en la ficha de centro, de una llamada en vivo a la API real (`getCentro`, ver
 * `src/server/api/client.ts`). Enumerar combinaciones de tipología/zona/id en build
 * sería además una lista que quedaría obsoleta en cuanto se resincronizara el índice.
 *
 * `RenderMode.Server` es el equivalente correcto de lo que hacían las Server Components
 * del original: computar y renderizar en cada petición, no en build. Con `'**'` como
 * único patrón basta — cubre todas las rutas del árbol (`app.routes.ts`) sin tener que
 * repetir la configuración por cada una; si en el futuro alguna ruta SÍ fuera
 * verdaderamente estática (por ejemplo una landing sin datos, candidata a prerender),
 * se añadiría su propia entrada por delante de este catch-all.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];

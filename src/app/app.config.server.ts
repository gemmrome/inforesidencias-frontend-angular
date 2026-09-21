import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { TransferState } from '@angular/core';

import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { CONFIG_CLIENTE_KEY, type ConfigCliente } from './core/config-cliente';
import { RECAPTCHA_SITE_KEY_POR_DEFECTO } from '../app/shared/leads/contrato';
import { PREPRODUCCION } from '../server/config/preproduccion';

/**
 * Este fichero SOLO se incluye en el bundle del SERVIDOR (lo arranca
 * `src/main.server.ts`, nunca `src/main.ts`), así que leer `process.env` y las
 * constantes de `src/server/` aquí es exactamente tan seguro como lo era en las Server
 * Components del proyecto original: el navegador nunca ve este código, solo el valor ya
 * calculado que el provider de abajo escribe en `TransferState`.
 *
 * IMPORTANTE: `provideServerRendering` se importa de `@angular/ssr`, NO de
 * `@angular/platform-server` (que era la ruta correcta en versiones antiguas de
 * Angular). Importarlo del paquete viejo compila sin avisar pero deja la cadena de
 * providers de la plataforma de servidor incompleta, y el síntoma es el críptico
 * `NG0401: Missing Platform` en tiempo de arranque — no un error en este fichero.
 *
 * `withRoutes(serverRoutes)` es obligatorio en cuanto el árbol de rutas tiene parámetros
 * (`:tipologia`, `:id`, `:slug`...): sin él, `ng build` intenta PRE-renderizar esas rutas
 * en tiempo de compilación y falla pidiendo `getPrerenderParams`. Ver
 * `app.routes.server.ts` — con `RenderMode.Server` en todas las rutas, se renderizan en
 * cada petición (como las Server Components del original), nunca en build.
 *
 * NO es una función `provide*` aparte (no existe `provideServerRouting` ni
 * `provideServerRoutesConfig` en esta versión): `withRoutes(...)` es una *feature* que
 * se le pasa como argumento a `provideServerRendering(...)`, igual que
 * `withComponentInputBinding()` se le pasa a `provideRouter(...)` en `app.config.ts`.
 */
function valoresConfigCliente(): ConfigCliente {
  return {
    preproduccion: PREPRODUCCION,
    recaptchaSiteKey: process.env['RECAPTCHA_SITE_KEY'] ?? RECAPTCHA_SITE_KEY_POR_DEFECTO,
    gtmId: process.env['GTM_ID'] || undefined,
    chatWidgetUrl: process.env['CHAT_WIDGET_URL'] || undefined,
  };
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(TransferState).set(CONFIG_CLIENTE_KEY, valoresConfigCliente());
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

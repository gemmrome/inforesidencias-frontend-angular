import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

/**
 * `context` es obligatorio aquí (Angular 20+): es lo que lleva el `BootstrapContext` del
 * motor de SSR (`AngularNodeAppEngine` en producción, o el middleware Vite SSR de
 * `ng serve` en desarrollo) hasta `bootstrapApplication`. Omitirlo compila sin avisar
 * pero produce `NG0401: Missing Platform` al arrancar, porque Angular no encuentra la
 * plataforma de servidor que ese contexto habría registrado.
 */
const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);

export default bootstrap;

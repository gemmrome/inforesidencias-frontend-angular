import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfigClienteService } from './core/config-cliente';

/**
 * Componente raíz. Portado de src/app/layout.tsx (el layout raíz de Next).
 *
 * Cabecera y pie NO están aquí: viven en `SiteShellComponent`, aplicado solo a las
 * rutas normales por el árbol de rutas — así la landing de la búsqueda proactiva puede
 * servirse a pantalla completa (ver `SiteShellComponent` para el porqué). Este
 * componente se queda con lo que de verdad es de toda la aplicación: el `<router-outlet>`
 * raíz y el contenedor de Google Tag Manager.
 *
 * GTM (GTM-M7C8CL5 en producción, docs/15): en Next lo inyectaba
 * `@next/third-parties/google`, que lo carga `afterInteractive` — nunca bloquea el
 * render inicial ni compite con el LCP. Aquí `afterNextRender` da la misma garantía:
 * solo se ejecuta en el navegador, después de la primera pintura. Sin `gtmId` (variable
 * de servidor, viaja por `ConfigClienteService`) no se inyecta nada.
 */
@Component({
  selector: 'ir-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(ConfigClienteService);

  constructor() {
    afterNextRender(() => {
      const gtmId = this.config.valores.gtmId;
      if (!gtmId) return;

      const dataLayerScript = this.document.createElement('script');
      dataLayerScript.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
      this.document.head.appendChild(dataLayerScript);

      // Sin equivalente al <noscript><iframe ns.html></noscript> del original: con
      // SSR la aplicación entera renderiza igualmente sin JavaScript, así que el
      // hueco de analítica-sin-JS que ese iframe cubría en un SPA puro no aplica aquí
      // de la misma forma. Pendiente si el equipo de analítica lo pide explícitamente.
    });
  }
}

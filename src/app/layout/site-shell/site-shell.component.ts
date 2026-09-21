import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteFooterComponent } from '../site-footer/site-footer.component';
import { SiteHeaderComponent } from '../site-header/site-header.component';

/**
 * Layout del SITIO: cabecera y pie de la navegación normal. Portado de
 * src/app/(sitio)/layout.tsx.
 *
 * POR QUÉ existe este componente separado del raíz (decisión PM, 2026-08-06 · docs/27,
 * docs/28): la landing de la búsqueda proactiva se sirve **sin cabecera ni pie**, para
 * que la pantalla no ofrezca ninguna salida que compita con el formulario. En Next
 * (App Router) eso se resolvía con el route group `(sitio)`, que bajaba la cabecera y
 * el pie del layout raíz a un layout hijo aplicado solo a las rutas normales. En
 * Angular el equivalente es una ruta padre con este componente como shell, envolviendo
 * con `<router-outlet>` solo las rutas hijas que deban llevar cabecera y pie — ver
 * `app.routes.ts`: la ruta `particulares/buscamos-por-ti` NO cuelga de esta, así se
 * sirve a pantalla completa igual que en el original.
 */
@Component({
  selector: 'ir-site-shell',
  standalone: true,
  imports: [SiteHeaderComponent, SiteFooterComponent, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-shell.component.html',
})
export class SiteShellComponent {}

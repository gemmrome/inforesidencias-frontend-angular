import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Pie B2C (revision-plantillas §1.8) con el fondo de marca de producción
 * (bg-footer.png: manos de cuidadora, duotono azul) — petición PM 2026-08-05. Portado
 * de src/components/layout/SiteFooter.tsx.
 *
 * Producción pone blanco sobre #627D98 (4,28:1, falla AA): aquí un velo azul-900
 * garantiza ≥4,5:1 del texto blanco en toda la superficie. Elemento de marca: idéntico
 * en modo claro y oscuro (como el hero).
 */
@Component({
  selector: 'ir-site-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-footer.component.html',
})
export class SiteFooterComponent {}

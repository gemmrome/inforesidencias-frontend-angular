import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EnlaceProactivaComponent } from '../../leads/enlace-proactiva/enlace-proactiva.component';

/**
 * Bloque de ayuda ÚNICO (revision-plantillas §2.3/§3.7, docs/08 §6.5) con las DOS vías
 * reales, sin mezclarlas: el TELÉFONO lo atiende una trabajadora social;
 * "Buscamos por ti" alimenta un matching automático (regla de copy, corrección PM
 * 2026-08-05). Portado de src/components/layout/BloqueAsesoramiento.tsx.
 *
 * Este bloque NO embebe el formulario: enlaza a `/particulares/buscamos-por-ti`, el
 * único punto de carga (decisión PM 2026-08-06, docs/28 §3.1 — el porqué está en
 * EnlaceProactivaComponent). El copy del botón ya no plantea las dos vías como
 * "llamar" / "no llamar" (corrección QA 2026-08-20, también documentada allí).
 */
@Component({
  selector: 'ir-bloque-asesoramiento',
  standalone: true,
  imports: [EnlaceProactivaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bloque-asesoramiento.component.html',
})
export class BloqueAsesoramientoComponent {
  /** Prerrellena la provincia en el formulario: la sabe la página que muestra el bloque. */
  readonly provincia = input<string>();
  /** Código de tipología (1 residencias, 2 centros de día…). */
  readonly tipologia = input<string>();
}

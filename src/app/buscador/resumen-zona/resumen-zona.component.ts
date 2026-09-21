import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { numES } from '../../shared/util/formato';
import type { EstadisticasZona } from '../../shared/buscador/listado.model';

const euros = (n: number) => `${numES(n)} €/mes`;

function fechaCalculoLegible(e: EstadisticasZona): string {
  return new Date(e.fechaCalculo).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Capa editorial data-driven por zona (§13 docs/03: PORTADA de producción, no
 * inventada), con cifra única + fecha (COMP-02): las mismas cifras que muestran las
 * FAQs y el JSON-LD, del mismo objeto `EstadisticasZona`. Portado de
 * src/components/buscador/ResumenZona.tsx.
 */
@Component({
  selector: 'ir-resumen-zona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumen-zona.component.html',
})
export class ResumenZonaComponent {
  readonly estadisticas = input.required<EstadisticasZona>();
  readonly tipoCorto = input.required<string>();
  readonly zonaEnFrase = input.required<string>();

  protected readonly numES = numES;
  protected readonly euros = euros;

  protected readonly tipo = computed(() => this.tipoCorto().toLowerCase());
  protected readonly fechaLegible = computed(() => fechaCalculoLegible(this.estadisticas()));
  protected readonly ratioLegible = computed(() => this.estadisticas().ratioMedio!.toLocaleString('es-ES', { minimumFractionDigits: 1 }));
}

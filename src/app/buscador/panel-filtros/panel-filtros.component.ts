import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { FACETAS_FILTRO, alternarFaceta, hayFiltros } from '../../shared/buscador/filtros';
import type { DatosPanel, FiltrosListado } from '../../shared/buscador/filtros';
import { numES } from '../../shared/util/formato';
import { FiltroPresupuestoComponent } from '../filtro-presupuesto/filtro-presupuesto.component';

/**
 * Filtros de detalle del listado (docs/08 §6.2 · Baymard §4.4): facetas de primer
 * nivel con CONTADORES y chips de lo aplicado siempre visibles. Portado de
 * src/components/buscador/PanelFiltros.tsx. Son enlaces `<a>`: funcionan sin JS y el
 * atrás del navegador funciona.
 */
@Component({
  selector: 'ir-panel-filtros',
  standalone: true,
  imports: [FiltroPresupuestoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-filtros.component.html',
})
export class PanelFiltrosComponent {
  readonly base = input.required<string>();
  /** Filtros activos, leídos de la URL. */
  readonly filtros = input.required<FiltrosListado>();
  /** Agregados de la zona SIN filtrar, calculados una vez en la página. */
  readonly datos = input.required<DatosPanel>();
  readonly orden = input.required<string>();
  /** Prefijo de ids: el panel se renderiza dos veces (móvil plegado / escritorio fijo). */
  readonly idPrefijo = input.required<string>();

  protected readonly facetas = FACETAS_FILTRO;
  protected readonly numES = numES;
  protected readonly hayFiltros = hayFiltros;
  protected readonly alternarFaceta = alternarFaceta;
}

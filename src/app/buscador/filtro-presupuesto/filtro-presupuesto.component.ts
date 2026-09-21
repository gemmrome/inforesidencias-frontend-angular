import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { numES } from '../../shared/util/formato';
import type { DatosPanel, FiltrosListado } from '../../shared/buscador/filtros';

/**
 * Presupuesto mensual con histograma (patrón Booking, petición PM 2026-08-05): el
 * usuario ve dónde está el grueso de la oferta ANTES de filtrar. Portado de
 * src/components/buscador/FiltroPresupuesto.tsx.
 *
 * Es un `<form>` real (GET): funciona sin JavaScript. Con JS (los signals `desde`/
 * `hasta`) solo se mejora la previsualización de las cifras mientras se arrastra.
 */
@Component({
  selector: 'ir-filtro-presupuesto',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filtro-presupuesto.component.html',
})
export class FiltroPresupuestoComponent {
  readonly base = input.required<string>();
  readonly filtros = input.required<FiltrosListado>();
  readonly orden = input.required<string>();
  readonly histograma = input.required<NonNullable<DatosPanel['histograma']>>();
  readonly totalConPrecio = input.required<number>();
  readonly idPrefijo = input.required<string>();

  protected readonly numES = numES;
  protected readonly Math = Math;

  private readonly desdeManual = signal<number | null>(null);
  private readonly hastaManual = signal<number | null>(null);

  protected readonly desde = computed(() => this.desdeManual() ?? this.filtros().precioMin ?? this.histograma().min);
  protected readonly hasta = computed(() => this.hastaManual() ?? this.filtros().precioMax ?? this.histograma().max);

  protected readonly maxBarra = computed(() => Math.max(...this.histograma().barras.map((b) => b.n), 1));

  protected readonly activo = computed(() => this.filtros().precioMin !== undefined || this.filtros().precioMax !== undefined);

  protected onDesde(e: Event): void {
    const v = Math.min(Number((e.target as HTMLInputElement).value), this.hasta());
    this.desdeManual.set(v);
  }

  protected onHasta(e: Event): void {
    const v = Math.max(Number((e.target as HTMLInputElement).value), this.desde());
    this.hastaManual.set(v);
  }
}

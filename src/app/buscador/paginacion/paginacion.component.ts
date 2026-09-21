import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { numES } from '../../shared/util/formato';

/**
 * Paginación truncada (« anterior · 1 … vecinas de la actual … última · siguiente »),
 * con el recuento "Mostrando X-Y de Z". Portado de src/components/buscador/Paginacion.tsx.
 * Todo son enlaces `<a>` (sin JS) y conservan filtros y orden vía `href()`.
 */
@Component({
  selector: 'ir-paginacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paginacion.component.html',
})
export class PaginacionComponent {
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  /** Total de resultados filtrados (para el "de Z"). */
  readonly total = input.required<number>();
  readonly porPagina = input.required<number>();
  /** Construye la URL de una página conservando filtros y orden. */
  readonly href = input.required<(n: number) => string>();

  protected readonly numES = numES;

  // Objetivos de 44px (docs/08 §5.5): este control lo usa mucho el público mayor.
  protected readonly cajaCss = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm';

  protected readonly desde = computed(() => (this.pagina() - 1) * this.porPagina() + 1);
  protected readonly hasta = computed(() => Math.min(this.pagina() * this.porPagina(), this.total()));

  // Números a mostrar: primera, última y las vecinas de la actual.
  protected readonly paginas = computed(() => {
    const pagina = this.pagina();
    const totalPaginas = this.totalPaginas();
    const mostrar = new Set<number>([1, totalPaginas, pagina - 1, pagina, pagina + 1]);
    if (pagina <= 3) [2, 3, 4].forEach((n) => mostrar.add(n));
    if (pagina >= totalPaginas - 2) [totalPaginas - 1, totalPaginas - 2, totalPaginas - 3].forEach((n) => mostrar.add(n));
    return [...mostrar].filter((n) => n >= 1 && n <= totalPaginas).sort((a, b) => a - b);
  });

  protected readonly hueco = computed(() => {
    const paginas = this.paginas();
    return (i: number) => {
      const anterior = paginas[i - 1];
      return anterior !== undefined && paginas[i] - anterior > 1;
    };
  });
}

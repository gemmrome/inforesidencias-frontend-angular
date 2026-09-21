import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { numES } from '../../shared/util/formato';
import type { DocIndice } from '../../shared/indice/tipos';

/**
 * Tarjeta de resultado unificada (docs/08 §6.1, revision-plantillas §2.4): jerarquía
 * precio real > índice de transparencia > ratio/plazas, CTA primaria "Ver ficha y
 * precios" + secundaria "Contactar". Portado de
 * src/components/buscador/TarjetaCentro.tsx.
 *
 * DIFERENCIA CON EL ORIGINAL: usaba `next/image` (redimensionado + WebP + caché propia
 * del servidor de imágenes de Next). Angular no trae un optimizador de imágenes
 * equivalente integrado en el servidor Express de este proyecto — aquí se sirve la URL
 * tal cual llega del índice, con `loading`/`fetchpriority` iguales a las del original
 * para no perder la señal de LCP de la primera tarjeta. Pendiente si hace falta
 * redimensionado real: `NgOptimizedImage` con un loader propio contra un CDN de
 * imágenes, cuando exista uno.
 */
@Component({
  selector: 'ir-tarjeta-centro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tarjeta-centro.component.html',
})
export class TarjetaCentroComponent {
  readonly doc = input.required<DocIndice>();
  readonly prioridad = input(false);

  protected readonly numES = numES;

  protected readonly href = computed(() => new URL(this.doc().url).pathname);

  protected readonly ratioLegible = computed(() => (this.doc().ratioPersonal! / 10).toLocaleString('es-ES', { minimumFractionDigits: 1 }));

  protected readonly fechaLegible = computed(() =>
    new Date(this.doc().fechaActualizacion!).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  );
}

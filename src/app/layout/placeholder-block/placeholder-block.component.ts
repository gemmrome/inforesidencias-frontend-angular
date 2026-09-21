import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { ConfigClienteService } from '../../core/config-cliente';

/**
 * Bloque pendiente de integración: reserva el hueco (y su altura aproximada para no
 * provocar CLS al integrarse) y deja visible qué falta y de qué depende. Portado de
 * src/components/PlaceholderBlock.tsx. Se elimina sección a sección según se integren
 * las piezas reales.
 */
@Component({
  selector: 'ir-placeholder-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './placeholder-block.component.html',
})
export class PlaceholderBlockComponent {
  readonly titulo = input.required<string>();
  readonly dependeDe = input.required<string>();
  readonly altura = input('auto');

  // Fuera de preproducción NO se renderiza (docs/23 §A-6): salían 2 recuadros ámbar
  // con referencias internas ("Se integra con: POST /centros/precio-medio") en cada
  // ficha pública. El interruptor está en el componente para que no dependa de
  // recordar borrarlo en cada punto de uso.
  protected readonly preproduccion = inject(ConfigClienteService).valores.preproduccion;
}

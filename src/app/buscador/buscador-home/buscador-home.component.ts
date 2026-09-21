import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { EnlaceProactivaComponent } from '../../leads/enlace-proactiva/enlace-proactiva.component';
import { BusquedaLibreComponent } from '../busqueda-libre/busqueda-libre.component';

/**
 * Buscador principal del hero — UN SOLO campo de texto (corrección PM 2026-08-05).
 * Portado de src/components/buscador/BuscadorHome.tsx.
 *
 * Es un `<form>` real contra /buscar: sin JavaScript el usuario escribe, pulsa Buscar y
 * el servidor interpreta y le lleva al listado (`/buscar` está pendiente de portar,
 * tarea 8). El desplegable de sugerencias (`BusquedaLibreComponent`) es mejora
 * progresiva, no requisito.
 */
@Component({
  selector: 'ir-buscador-home',
  standalone: true,
  imports: [BusquedaLibreComponent, EnlaceProactivaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './buscador-home.component.html',
})
export class BuscadorHomeComponent {
  readonly tipologias = input<{ slug: string; nombre: string }[]>([]);

  protected readonly tipologia = signal('residencias');

  constructor() {
    // El valor inicial del <select> es el primero de la lista, igual que el
    // `useState(tipologias[0]?.slug ?? "residencias")` del original.
    const primeras = this.tipologias();
    if (primeras[0]) this.tipologia.set(primeras[0].slug);
  }
}

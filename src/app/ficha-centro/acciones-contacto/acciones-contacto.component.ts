import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { enviarEvento } from '../../shared/analitica/eventos';

/**
 * "Ver teléfono" y "Ver web": las dos acciones que se miden POR SEPARADO y cuyo
 * resultado se le entrega a cada residencia (PM, 2026-08-14). Portado de
 * src/components/ficha/AccionesContacto.tsx.
 *
 * El teléfono no se pinta directo: queda detrás de un clic medible. El clic se
 * registra en dos sitios — `/api/puente/interaccion-centro/…` (estadística para la
 * residencia) y `dataLayer` (analítica de producto) — series distintas, no se suman.
 */
@Component({
  selector: 'ir-acciones-contacto',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './acciones-contacto.component.html',
})
export class AccionesContactoComponent {
  readonly idCentro = input.required<number>();
  readonly nombreCentro = input.required<string>();
  readonly telefono = input<string | undefined>(undefined);
  readonly web = input<string | undefined>(undefined);

  protected readonly visible = signal(false);

  /** `sendBeacon` y no `fetch`: en "Ver web" el navegador se va de la página en el
   *  mismo gesto, y un fetch normal se cancela al descargarse el documento. */
  protected registrar(accion: 'telefono' | 'web'): void {
    const url = `/api/puente/interaccion-centro/${this.idCentro()}/${accion}`;
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) navigator.sendBeacon(url);
    else void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
    enviarEvento(`ver_${accion}`, { id_centro: this.idCentro(), nombre_centro: this.nombreCentro() });
  }

  protected verTelefono(): void {
    this.registrar('telefono');
    this.visible.set(true);
  }

  protected telefonoHref(): string {
    return `tel:${(this.telefono() ?? '').replace(/\s+/g, '')}`;
  }
}

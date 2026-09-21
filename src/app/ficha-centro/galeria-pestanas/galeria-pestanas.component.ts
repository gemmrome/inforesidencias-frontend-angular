import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { hayQuePintarPestanas, type ClavePestana, type Pestana } from '../../shared/galeria/pestanas';

/**
 * La galería de la ficha con pestañas — SIN UNA LÍNEA DE JAVASCRIPT (radios + CSS,
 * `.galeria-pestanas` en `styles.css`; el porqué frente a WAI-ARIA tabs o `:target` está
 * documentado allí). Portado de src/components/ficha/GaleriaPestanas.tsx.
 *
 * Los tres paneles se proyectan como contenido (`ng-content select`) en vez de recibirse
 * como un objeto `paneles`, que no tiene equivalente directo en Angular: el padre
 * (`FichaCentroPageComponent`) marca cada bloque con el atributo `panelCentro`/
 * `panelComida`/`panelVideos`. Solo se pinta el `<div data-panel>` de una pestaña si esa
 * clave está en `pestanas()` — "lo que no hay no se nombra" también aquí.
 *
 * Con un único grupo con contenido no se pinta ninguna barra: el panel se ve solo,
 * como si nunca hubiera existido la galería con pestañas.
 */
@Component({
  selector: 'ir-galeria-pestanas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './galeria-pestanas.component.html',
})
export class GaleriaPestanasComponent {
  readonly idCentro = input.required<number>();
  readonly pestanas = input.required<Pestana[]>();

  protected readonly grupo = computed(() => `galeria-${this.idCentro()}`);
  protected readonly mostrarPestanas = computed(() => hayQuePintarPestanas(this.pestanas()));

  protected tienePestana(clave: ClavePestana): boolean {
    return this.pestanas().some((p) => p.clave === clave);
  }

  protected idRadio(clave: ClavePestana): string {
    return `${this.grupo()}-${clave}`;
  }
}

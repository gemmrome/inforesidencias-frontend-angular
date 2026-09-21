import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

export interface EnlaceMenu {
  href: string;
  etiqueta: string;
}

/**
 * Menú móvil de la cabecera. Portado de src/components/layout/MenuMovil.tsx.
 *
 * POR QUÉ EXISTE ESTE COMPONENTE (QA, 2026-08-19, iPhone 15): «cuando abro las 3 rayas
 * del menú para seleccionar una opción, se me queda abierto y no me permite cerrarlo de
 * ninguna manera». El menú es un `<details>` nativo SIN JavaScript, y un `<details>`
 * solo se cierra volviendo a pulsar su `<summary>`. Eso deja tres agujeros:
 *
 *  1. Elegir una opción no lo cierra (el layout no se remonta al navegar).
 *  2. Tocar fuera no lo cierra (comportamiento nativo de `<details>`).
 *  3. Escape no lo cierra, así que con teclado tampoco hay salida.
 *
 * SE MANTIENE EL `<details>` NATIVO a propósito: es accesible por teclado de serie y
 * sin JavaScript sigue abriendo y cerrando igual que hasta hoy (mejora progresiva). Lo
 * que añade este componente son los tres cierres que faltaban, nada más.
 *
 * En Angular el equivalente de "cerrar al navegar" es suscribirse a `Router.events`
 * filtrando `NavigationEnd`, en vez del `usePathname()` + `useEffect` original — cubre
 * igualmente las navegaciones que no salen de un enlace del panel (atrás/adelante,
 * redirección). Los listeners de documento (tocar fuera, Escape) se añaden en
 * `afterNextRender` para no ejecutarse durante el renderizado en servidor, y se
 * retiran con `DestroyRef` en vez del cleanup de `useEffect`.
 */
@Component({
  selector: 'ir-menu-movil',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-movil.component.html',
})
export class MenuMovilComponent {
  readonly nav = input.required<readonly EnlaceMenu[]>();
  readonly externos = input.required<readonly EnlaceMenu[]>();

  private readonly detalle = viewChild.required<ElementRef<HTMLDetailsElement>>('detalle');
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // (1) Cerrar al navegar.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cerrar());

    // (2) tocar fuera y (3) Escape — solo en el navegador.
    afterNextRender(() => {
      const alPulsarFuera = (evento: PointerEvent) => {
        const el = this.detalle().nativeElement;
        if (!el.open) return;
        // `pointerdown` y no `click`: en Safari de iOS un `click` sobre una zona sin
        // manejador propio no siempre llega hasta `document`, y esa zona muerta es
        // justo donde toca el usuario cuando quiere cerrar el menú.
        if (evento.target instanceof Node && !el.contains(evento.target)) el.open = false;
      };

      const alPulsarEscape = (evento: KeyboardEvent) => {
        if (evento.key !== 'Escape') return;
        const el = this.detalle().nativeElement;
        if (!el.open) return;
        el.open = false;
        // El foco se quedaría dentro de un panel que acaba de desaparecer: se
        // devuelve al botón que lo abrió (patrón WAI-ARIA de menú desplegable).
        el.querySelector<HTMLElement>('summary')?.focus();
      };

      this.document.addEventListener('pointerdown', alPulsarFuera);
      this.document.addEventListener('keydown', alPulsarEscape);
      this.destroyRef.onDestroy(() => {
        this.document.removeEventListener('pointerdown', alPulsarFuera);
        this.document.removeEventListener('keydown', alPulsarEscape);
      });
    });
  }

  protected cerrar(): void {
    const el = this.detalle().nativeElement;
    if (el.open) el.open = false;
  }
}

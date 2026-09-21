import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/**
 * Enlace a "Buscamos por ti" desde la home, los listados y las fichas. Portado de
 * src/components/leads/EnlaceProactiva.tsx.
 *
 * POR QUÉ ES UN ENLACE Y NO UN FORMULARIO EMBEBIDO (decisión PM, 2026-08-06): con el
 * formulario repartido por 10 páginas el embudo de conversión no se podía medir
 * (docs/28 §3.1: 711 clics, solo 207 llegadas a la landing). Ahora hay UN SOLO punto de
 * carga: `/particulares/buscamos-por-ti`.
 *
 * COPY (RP-01, honestidad): el teléfono lo atiende una trabajadora social; este
 * formulario alimenta un matching automático — nunca se le atribuye a la trabajadora
 * social. Etiqueta por defecto "Cuéntanos qué necesitas" (cambio QA 2026-08-20: la
 * anterior, "Prefiero no llamar", nombraba la vía por lo que el usuario NO hace).
 *
 * CONTEXTO que viaja (docs/27 §E-2): `volver` para poder regresar a donde estaba el
 * usuario, y `provincia`/`tipologia` para no volver a preguntar lo que ya se sabe.
 */
@Component({
  selector: 'ir-enlace-proactiva',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './enlace-proactiva.component.html',
})
export class EnlaceProactivaComponent {
  readonly provincia = input<string>();
  readonly tipologia = input<string>();
  readonly etiqueta = input('Cuéntanos qué necesitas');
  readonly claseCss = input<string | undefined>(undefined, { alias: 'class' });

  protected readonly claseDefecto =
    'inline-flex min-h-11 items-center rounded-md border border-borde-input px-4 py-2.5 text-sm font-medium hover:bg-fondo';

  private readonly router = inject(Router);

  protected parametros(): Record<string, string> {
    const p: Record<string, string> = {};
    const volver = this.router.url.split('?')[0];
    if (volver) p['volver'] = volver;
    if (this.provincia()) p['provincia'] = this.provincia()!;
    if (this.tipologia()) p['tipologia'] = this.tipologia()!;
    return p;
  }
}

import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, Title, type SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { numES } from '../../shared/util/formato';
import { jsonLdSeguro } from '../../shared/seguridad/jsonld';
import type { RespuestaFichaCentro } from '../../shared/ficha-centro/ficha-centro.model';
import type { Caracteristica } from '../../shared/dominio/centro.model';
import { BloqueAsesoramientoComponent } from '../../layout/bloque-asesoramiento/bloque-asesoramiento.component';
import { PlaceholderBlockComponent } from '../../layout/placeholder-block/placeholder-block.component';
import { FormularioContactoCentroComponent } from '../../leads/formulario-contacto-centro/formulario-contacto-centro.component';
import { AccionesContactoComponent } from '../acciones-contacto/acciones-contacto.component';
import { GaleriaPestanasComponent } from '../galeria-pestanas/galeria-pestanas.component';
import { PanelComidaComponent } from '../panel-comida/panel-comida.component';
import { VideoEmbedComponent } from '../video-embed/video-embed.component';
import { MapaCentroComponent } from '../mapa-centro/mapa-centro.component';
import { FichaSinInformacionComponent } from '../ficha-sin-informacion/ficha-sin-informacion.component';

/**
 * Ficha de centro (tarea 6, MIGRACION.md): detalle, galería con pestañas, tabla de
 * precios, panel de comida, acciones de contacto, mapa del centro. Portado de
 * src/app/(sitio)/centros/[tipo]/[id]/[slug]/page.tsx (852 líneas).
 *
 * DIFERENCIA ARQUITECTÓNICA (la misma que `ListadoPageComponent`): todo el cálculo —
 * canonicidad, galería, comida, JSON-LD, sugerencias del centro sin información — vive
 * en `GET /api/v1/ficha-centro` (`src/server/routes/ficha-centro.ts`); este componente
 * solo pide y pinta. La existencia y la canonicidad de la URL (404/308 REALES) las
 * resuelve ANTES `fichaCentroPaginas` en `server.ts`: cuando Angular llega a renderizar
 * esta página, la URL ya es la canónica de un centro que existe.
 *
 * PENDIENTE (fuera del alcance ya acordado): `SlotPatrocinio`/`ResultadoPatrocinado`
 * (anuncios) y el canonical/OpenGraph completos (tarea 9, SEO) — el JSON-LD SÍ se
 * pinta aquí porque el servidor ya lo calcula igual que el original.
 */
@Component({
  selector: 'ir-ficha-centro-page',
  standalone: true,
  imports: [
    AccionesContactoComponent,
    GaleriaPestanasComponent,
    PanelComidaComponent,
    VideoEmbedComponent,
    MapaCentroComponent,
    FichaSinInformacionComponent,
    FormularioContactoCentroComponent,
    PlaceholderBlockComponent,
    BloqueAsesoramientoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ficha-centro-page.component.html',
})
export class FichaCentroPageComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);

  protected readonly numES = numES;

  protected readonly datos = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const httpParams = {
          tipo: params.get('tipo') ?? '',
          id: params.get('id') ?? '',
          slug: params.get('slug') ?? '',
        };
        return this.http.get<RespuestaFichaCentro>('/api/v1/ficha-centro', { params: httpParams }).pipe(
          catchError(() => of<RespuestaFichaCentro>({ encontrado: false })),
        );
      }),
    ),
    { initialValue: null },
  );

  protected readonly tipologiaAsesoramiento = computed(() => {
    const d = this.datos();
    if (!d?.encontrado || !d.esMiembro) return '1';
    const cod = d.centro.tipologiaCod;
    return String(cod === 2 || cod === 8 || cod === 10 ? cod : 1);
  });

  constructor() {
    // Título — lo mínimo de SEO indispensable (el resto, tarea 9, pendiente); el
    // JSON-LD sí se inyecta completo porque el servidor ya lo calcula.
    effect(() => {
      const d = this.datos();
      if (!d?.encontrado) return;
      this.title.setTitle(d.tituloPagina);
      this.inyectarJsonLd(d.jsonLd);
    });
  }

  /** `<script type="application/ld+json">` no se puede escribir en la plantilla de un
   *  componente Angular (el compilador descarta las etiquetas `<script>`): se inyecta
   *  igual que el CSS de Leaflet en `MapaResultadosComponent`, vía `DOCUMENT`. Corre
   *  también en SSR — `DOCUMENT` es portable entre servidor y navegador — así que el
   *  HTML servido ya lo lleva, no hace falta esperar a la hidratación. */
  private inyectarJsonLd(datos: object[]): void {
    this.document.getElementById('ld-ficha')?.remove();
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'ld-ficha';
    script.textContent = jsonLdSeguro(datos);
    this.document.head.appendChild(script);
  }

  protected descripcionSegura(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /** Sí/No/valor — equivalente de `ValorCaracteristica` en el original. */
  protected valorCaracteristica(c: Caracteristica): { texto: string; clase: string } {
    if (c.valor === true) return { texto: 'Sí', clase: 'text-exito font-medium' };
    if (c.valor === false) return { texto: 'No', clase: 'text-texto-secundario' };
    return { texto: typeof c.valor === 'number' ? numES(c.valor) : c.valor, clase: '' };
  }
}

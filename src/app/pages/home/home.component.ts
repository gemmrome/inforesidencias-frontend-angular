import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { numES } from '../../shared/util/formato';
import type { DocIndice } from '../../shared/indice/tipos';
import { BuscadorHomeComponent } from '../../buscador/buscador-home/buscador-home.component';
import { BloqueAsesoramientoComponent } from '../../layout/bloque-asesoramiento/bloque-asesoramiento.component';

interface RespuestaHome {
  totalDocs: number;
  conTransparencia: number;
  generado: string;
  anioInicioAyuda: number;
  anosAyudando: number;
  ccaaOrdenadas: { slug: string; nombre: string; n: number }[];
  provinciasTop: { slug: string; nombre: string; ccaa: string; n: number }[];
  topTransparentes: DocIndice[];
  tipologiasHome: { slug: string; nombre: string; cod: number; centros: number }[];
  familiasListado: { slug: string; fraseCorta: string }[];
}

/**
 * Página de inicio. Portado de src/app/(sitio)/page.tsx: distribuidor de linking de
 * nivel 1 (hero con buscador, cifras reales, escaparate de transparencia, distribuidor
 * geográfico y asesoramiento).
 *
 * DIFERENCIA ARQUITECTÓNICA con el original: allí era un Server Component que leía el
 * índice directamente; aquí pide sus datos a `GET /api/v1/home` (ver
 * `src/server/routes/home.ts`, que hace el mismo cálculo) — mismo motivo que en
 * `ListadoPageComponent`: un componente Angular no puede importar `src/server/`.
 */
@Component({
  selector: 'ir-home-page',
  standalone: true,
  imports: [RouterLink, BuscadorHomeComponent, BloqueAsesoramientoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomePageComponent {
  private readonly http = inject(HttpClient);

  protected readonly numES = numES;
  protected readonly pathname = (url: string) => new URL(url).pathname;

  protected readonly datos = toSignal(this.http.get<RespuestaHome>('/api/v1/home'), { initialValue: null });

  protected readonly tipologiasBuscador = computed(
    () => this.datos()?.tipologiasHome.map((t) => ({ slug: t.slug, nombre: t.nombre })) ?? [],
  );
}

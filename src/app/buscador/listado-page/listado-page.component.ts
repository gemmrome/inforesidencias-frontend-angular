import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { numES } from '../../shared/util/formato';
import { FACETAS_FILTRO, alternarFaceta, aQuery, hayFiltros, quitarPrecio } from '../../shared/buscador/filtros';
import type { RespuestaListadoApi } from '../../shared/buscador/listado.model';
import { BloqueAsesoramientoComponent } from '../../layout/bloque-asesoramiento/bloque-asesoramiento.component';
import { EnlaceProactivaComponent } from '../../leads/enlace-proactiva/enlace-proactiva.component';
import { BusquedaLibreComponent } from '../busqueda-libre/busqueda-libre.component';
import { MapaResultadosComponent } from '../mapa-resultados/mapa-resultados.component';
import { PaginacionComponent } from '../paginacion/paginacion.component';
import { PanelFiltrosComponent } from '../panel-filtros/panel-filtros.component';
import { ResumenZonaComponent } from '../resumen-zona/resumen-zona.component';
import { TarjetaCentroComponent } from '../tarjeta-centro/tarjeta-centro.component';

/**
 * Páginas geográficas del buscador (tarea 2 del original, docs/04: mayor oportunidad
 * SEO). Portado de src/app/(sitio)/centros/buscador/[tipologia]/[[...geo]]/page.tsx
 * (694 líneas) — el archivo más grande del proyecto original.
 *
 * DIFERENCIA ARQUITECTÓNICA con el original: aquí NO se recalcula nada de dominio; todo
 * el cálculo (`contenidoDe()` allí) vive en `GET /api/v1/listado`
 * (`src/server/routes/listado.ts`, misma lógica, mismas funciones portadas de
 * `indice/`, `estadisticas/` y `buscador/filtros`). Este componente solo compone la
 * petición a partir de la ruta y pinta la respuesta.
 *
 * RUTA: Next usaba un catch-all opcional `[[...geo]]` (0 a 3 segmentos geográficos
 * después de la tipología). El Router de Angular no tiene un equivalente directo de
 * "resto de segmentos" combinado con parámetros con nombre en la misma ruta (su
 * comodín `**` solo puede ser la ruta entera), así que `app.routes.ts` declara 4
 * entradas — 0, 1, 2 y 3 segmentos de geografía — que apuntan todas aquí; este
 * componente reconstruye el array `geo` a partir de los que existan.
 *
 * PENDIENTE (no portado, fuera del alcance ya acordado): `SlotPatrocinio` /
 * `ResultadoPatrocinado` (anuncios) y el canonical/OpenGraph/JSON-LD completos por
 * ruta (tarea 9, SEO) — aquí solo se fija el `<title>` con `Title`, que es lo mínimo
 * indispensable para navegar sin que todas las páginas se llamen igual.
 */
@Component({
  selector: 'ir-listado-page',
  standalone: true,
  imports: [
    RouterLink,
    BusquedaLibreComponent,
    PanelFiltrosComponent,
    MapaResultadosComponent,
    TarjetaCentroComponent,
    PaginacionComponent,
    ResumenZonaComponent,
    BloqueAsesoramientoComponent,
    EnlaceProactivaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listado-page.component.html',
})
export class ListadoPageComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  protected readonly numES = numES;
  protected readonly hayFiltros = hayFiltros;
  protected readonly alternarFaceta = alternarFaceta;
  protected readonly quitarPrecio = quitarPrecio;
  protected readonly aQuery = aQuery;
  protected readonly String = String;

  protected readonly respuesta = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      switchMap(([params, query]) => {
        const tipologia = params.get('tipologia') ?? '';
        const geo = [params.get('g1'), params.get('g2'), params.get('g3')].filter((s): s is string => !!s).join('/');
        const httpParams: Record<string, string> = { tipologia, geo };
        const f = query.get('f');
        const precioMin = query.get('precioMin');
        const precioMax = query.get('precioMax');
        const orden = query.get('orden');
        const page = query.get('page');
        if (f) httpParams['f'] = f;
        if (precioMin) httpParams['precioMin'] = precioMin;
        if (precioMax) httpParams['precioMax'] = precioMax;
        if (orden) httpParams['orden'] = orden;
        if (page) httpParams['page'] = page;
        return this.http.get<RespuestaListadoApi>('/api/v1/listado', { params: httpParams }).pipe(
          // Una tipología desconocida en la URL (typo, enlace roto) responde 400: se
          // normaliza al mismo "no encontrado" que una zona inexistente en vez de
          // dejar el signal colgado con un error sin manejar.
          catchError(() => of<RespuestaListadoApi>({ encontrado: false })),
        );
      }),
    ),
    { initialValue: null },
  );

  constructor() {
    // Reacciona a cada respuesta nueva de `/api/v1/listado` (cambia de zona, de
    // filtros, de página…): redirección permanente equivalente al
    // `permanentRedirect()` del original cuando el slug de 3 niveles tiene provincia
    // válida pero comarca/población desconocida, y título de página — lo mínimo de
    // SEO indispensable para no navegar con todas las páginas llamándose igual (el
    // resto, canonical/OpenGraph/JSON-LD, es la tarea 9, pendiente).
    effect(() => {
      const r = this.respuesta();
      if (!r) return;
      if (!r.encontrado) {
        if (r.redirect) void this.router.navigateByUrl(r.redirect, { replaceUrl: true });
        return;
      }
      this.title.setTitle(`${r.ctx.tipoCorto} en ${r.ctx.zonaCorto}`);
    });
  }

  protected etiquetaFaceta(clave: string): string {
    return FACETAS_FILTRO.find((f) => f.clave === clave)?.etiqueta ?? clave;
  }

  protected contadorFiltros(r: Extract<RespuestaListadoApi, { encontrado: true }>): number {
    return r.filtros.facetas.length + (r.filtros.precioMin !== undefined || r.filtros.precioMax !== undefined ? 1 : 0);
  }

  protected ordenHref(r: Extract<RespuestaListadoApi, { encontrado: true }>, clave: 'transparencia' | 'actualizacion'): string {
    const q = new URLSearchParams(aQuery(r.filtros).replace('?', ''));
    if (clave !== 'transparencia') q.set('orden', clave);
    const qs = q.toString();
    return `${r.base}${qs ? `?${qs}` : ''}`;
  }

  protected hrefPagina(r: Extract<RespuestaListadoApi, { encontrado: true }>): (n: number) => string {
    return (n: number) => {
      const q = new URLSearchParams(aQuery(r.filtros).replace('?', ''));
      if (r.orden !== 'transparencia') q.set('orden', r.orden);
      if (n > 1) q.set('page', String(n));
      const qs = q.toString();
      return `${r.base}${qs ? `?${qs}` : ''}`;
    };
  }

  protected rutaSinTipologia(r: Extract<RespuestaListadoApi, { encontrado: true }>): string {
    // `r.base` es `/centros/buscador/<tipologia><geo>`; se quita el primer tramo para
    // recomponerlo con `directorio`.
    return r.base.replace(`/centros/buscador/${r.ctx.rutaTipologia}`, '');
  }

  protected provinciaSlug(r: Extract<RespuestaListadoApi, { encontrado: true }>): string {
    return this.rutaSinTipologia(r).split('/').filter(Boolean).pop() ?? '';
  }

  protected fechaSyncLegible(iso: string): string {
    return new Date(iso).toLocaleString('es-ES');
  }
}

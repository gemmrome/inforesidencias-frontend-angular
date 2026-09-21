import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { numES } from '../../shared/util/formato';
import type { SugerenciasMiembrosApi } from '../../shared/ficha-centro/ficha-centro.model';
import { MapaResultadosComponent } from '../../buscador/mapa-resultados/mapa-resultados.component';
import type { PuntoMapa } from '../../shared/buscador/puntos-mapa';

function etiquetaDeNivel(nivel: SugerenciasMiembrosApi['nivel'], zona: string): string {
  switch (nivel) {
    case 'poblacion':
      return `en ${zona}`;
    case 'comarca':
      return `en la comarca de ${zona}`;
    case 'provincia':
      return `en la provincia de ${zona}`;
  }
}

/**
 * Ficha de un centro que no ha facilitado información a Inforesidencias (docs/26).
 * Portado de src/components/ficha/FichaSinInformacion.tsx.
 *
 * Decisión de PM (2026-08-06): decirle la verdad al usuario y ofrecerle alternativas
 * que sí publican datos, más una vía para que el responsable del centro lo reclame.
 * Tres reglas que no conviene deshacer sin releer: (1) sigue pareciendo una ficha, no
 * un listado — el centro buscado manda la página; (2) dirección sí, teléfono no — dar
 * el teléfono de un centro sin verificar es un flaco favor; (3) ni una palabra sobre la
 * calidad del centro — esta página compite por su nombre en el buscador.
 */
@Component({
  selector: 'ir-ficha-sin-informacion',
  standalone: true,
  imports: [MapaResultadosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ficha-sin-informacion.component.html',
})
export class FichaSinInformacionComponent {
  readonly nombre = input.required<string>();
  readonly tipologia = input.required<string>();
  readonly direccion = input<string | undefined>(undefined);
  readonly codigoPostal = input<string | undefined>(undefined);
  readonly poblacion = input.required<string>();
  readonly provincia = input.required<string>();
  readonly sugerencias = input.required<SugerenciasMiembrosApi | null>();
  readonly urlAlta = input.required<string>();
  readonly geo = input<{ lat: number; lng: number } | undefined>(undefined);

  protected readonly numES = numES;

  protected readonly puntoActual = computed<PuntoMapa[]>(() => {
    const g = this.geo();
    return g
      ? [{ id: 'actual', nombre: this.nombre(), poblacion: this.poblacion(), precioDesde: null, transparencia: null, ruta: '', lat: g.lat, lng: g.lng, destacado: true }]
      : [];
  });

  protected readonly puntosSugeridos = computed<PuntoMapa[]>(() =>
    (this.sugerencias()?.centros ?? [])
      .filter((c) => c.geo)
      .map((c) => ({
        id: String(c.centroId),
        nombre: c.nombre,
        poblacion: c.poblacion,
        precioDesde: c.precioDesde,
        transparencia: c.transparencia,
        ruta: new URL(c.url).pathname,
        lat: c.geo!.lat,
        lng: c.geo!.lng,
      })),
  );

  protected readonly puntos = computed<PuntoMapa[]>(() => [...this.puntoActual(), ...this.puntosSugeridos()]);

  protected readonly direccionTexto = computed(
    () => `${this.direccion() ? `${this.direccion()}, ` : ''}${this.codigoPostal() ? `${this.codigoPostal()} ` : ''}${this.poblacion()} (${this.provincia()})`,
  );

  protected rutaSugerencia(url: string): string {
    return new URL(url).pathname;
  }

  protected etiquetaNivel(): string {
    const s = this.sugerencias();
    return s ? etiquetaDeNivel(s.nivel, s.zona) : '';
  }
}

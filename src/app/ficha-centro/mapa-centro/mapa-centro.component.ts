import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

/**
 * Ubicación del centro SIN COSTE y sin terceros por defecto (decisión PM 2026-08-05).
 * Portado de src/components/ficha/MapaCentro.tsx.
 *
 * - Mapa: OpenStreetMap embed, click-to-load — cero peticiones externas hasta que el
 *   usuario pulsa, así que no penaliza el LCP ni depende de que se acepten cookies.
 * - Cómo llegar: enlaces a la app de mapas del usuario (Google/Apple/OSM), sin coste.
 * - La vista previa es un SVG inline (plano abstracto, no calles reales) con los tokens
 *   del sistema: se adapta a claro/oscuro y no cuesta ninguna petición.
 */
@Component({
  selector: 'ir-mapa-centro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa-centro.component.html',
})
export class MapaCentroComponent {
  readonly geo = input<{ lat: number; lng: number } | undefined>(undefined);
  readonly direccionCompleta = input.required<string>();
  readonly nombre = input.required<string>();

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly visible = signal(false);

  private readonly consulta = computed(() => encodeURIComponent(`${this.nombre()}, ${this.direccionCompleta()}`));
  protected readonly destino = computed(() => {
    const g = this.geo();
    return g ? `${g.lat},${g.lng}` : this.consulta();
  });

  // Recuadro ~1,5 km alrededor del centro: suficiente para situar el barrio.
  protected readonly bbox = computed(() => {
    const g = this.geo();
    return g ? [g.lng - 0.009, g.lat - 0.005, g.lng + 0.009, g.lat + 0.005].join('%2C') : null;
  });

  protected readonly embedSrc = computed<SafeResourceUrl>(() => {
    const g = this.geo();
    const url = g ? `https://www.openstreetmap.org/export/embed.html?bbox=${this.bbox()}&layer=mapnik&marker=${g.lat}%2C${g.lng}` : '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
}

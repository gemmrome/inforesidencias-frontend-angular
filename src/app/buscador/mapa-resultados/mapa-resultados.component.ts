import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const VERSION_LEAFLET = '1.9.4'; // debe coincidir con la dependencia "leaflet" de package.json
let cssLeafletInyectado = false;

import { numES } from '../../shared/util/formato';
import { textoBotonMapa } from '../../shared/buscador/puntos-mapa';
import type { PuntoMapa } from '../../shared/buscador/puntos-mapa';

/**
 * Mapa de resultados con BURBUJAS DE PRECIO (patrón Airbnb/Booking, petición PM
 * 2026-08-05). Portado de src/components/buscador/MapaResultados.tsx.
 *
 * Motor: Leaflet + teselas de OpenStreetMap, sin claves ni coste (mismo motor que el
 * original; el porqué de la elección frente a MapLibre está documentado allí).
 *
 * Carga BAJO DEMANDA: ni la librería, ni las teselas, ni los puntos se piden hasta que
 * el usuario pulsa "Ver en el mapa" — `import('leaflet')` es un import dinámico
 * también en Angular, así que el comportamiento es idéntico al original.
 *
 * DOS MODOS (tarea 6, ficha de centro): `url` — bajo demanda vía fetch, el que usa el
 * listado del buscador — o `puntos` — el array ya en memoria, sin petición ninguna,
 * que usa `FichaSinInformacionComponent` (un único centro con hasta 4 sugerencias, no
 * merece un viaje de red). Con `puntos` puesto, `abrir()` no llama a `HttpClient`.
 */
@Component({
  selector: 'ir-mapa-resultados',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa-resultados.component.html',
})
export class MapaResultadosComponent {
  readonly url = input<string | null>(null);
  readonly puntos = input<PuntoMapa[] | null>(null);
  readonly total = input.required<number>();
  readonly topeAlcanzado = input(false);
  readonly sinCoordenadas = input(0);

  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly contenedor = viewChild<ElementRef<HTMLDivElement>>('contenedor');

  protected readonly numES = numES;
  protected readonly textoBotonMapa = textoBotonMapa;

  protected readonly abierto = signal(false);
  protected readonly error = signal(false);
  protected readonly pedidos = signal<PuntoMapa[]>([]);
  protected readonly conPrecio = signal(0);

  private mapaLeaflet: { remove: () => void } | null = null;

  protected async abrir(): Promise<void> {
    this.abierto.set(true);
    this.error.set(false);
    // Esperar al siguiente ciclo para que `#contenedor` exista en el DOM.
    await new Promise((r) => setTimeout(r, 0));
    const el = this.contenedor()?.nativeElement;
    if (!el) return;

    try {
      // El CSS de Leaflet se carga AQUÍ, bajo demanda: si el mapa no se abre nunca, ni
      // la librería ni sus estilos se descargan (docs/23 §B-5). En el original era un
      // `import("leaflet/dist/leaflet.css")` dentro del import() dinámico; aquí se
      // inserta como <link> en tiempo de ejecución en vez de depender de que el
      // bundler de Angular sepa trocear un import de CSS desde un fichero .ts (no
      // verificable sin poder compilar este proyecto) — mismo resultado: un único
      // fetch, cacheado por el navegador, disparado solo al abrir el mapa.
      this.inyectarCssLeaflet();
      const directos = this.puntos();
      const [L, puntos] = await Promise.all([
        import('leaflet').then((m) => m.default),
        directos ? Promise.resolve(directos) : firstValueFrom(this.http.get<{ puntos: PuntoMapa[] }>(this.url()!)).then((d) => d.puntos),
      ]);
      this.pedidos.set(puntos);
      this.conPrecio.set(puntos.filter((p) => p.precioDesde !== null).length);
      if (puntos.length === 0) throw new Error('mapa: sin puntos que dibujar');

      const m = L.map(el, { scrollWheelZoom: false });
      this.mapaLeaflet = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>',
      }).addTo(m);

      for (const p of puntos) {
        const conPrecio = p.precioDesde !== null;
        const icono = L.divIcon({
          className: '',
          html: p.destacado
            ? `<span style="display:block;width:18px;height:18px;border-radius:9999px;border:3px solid #102a43;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`
            : conPrecio
              ? `<span style="display:inline-block;white-space:nowrap;border-radius:9999px;border:1px solid #fff;background:#102a43;color:#fff;padding:3px 8px;font:700 12px/1.2 system-ui;box-shadow:0 1px 4px rgba(0,0,0,.35)">${numES(p.precioDesde!)} &euro;</span>`
              : `<span style="display:block;width:12px;height:12px;border-radius:9999px;border:2px solid #fff;background:#627d98;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
          iconSize: p.destacado ? [18, 18] : conPrecio ? [64, 22] : [12, 12],
          iconAnchor: p.destacado ? [9, 9] : conPrecio ? [32, 11] : [6, 6],
        });
        const popup = p.destacado
          ? `<strong>${p.nombre}</strong><br>${p.poblacion}<br><em>Est&aacute;s viendo este centro. No publica precio en Inforesidencias.</em>`
          : `<a href="${p.ruta}" style="font-weight:600">${p.nombre}</a><br>${p.poblacion}` +
            (conPrecio ? `<br><strong>desde ${numES(p.precioDesde!)} &euro;/mes</strong>` : '') +
            (p.transparencia !== null ? `<br>Transparencia: ${p.transparencia}%` : '');
        L.marker([p.lat, p.lng], { icon: icono, title: p.nombre }).addTo(m).bindPopup(popup);
      }

      // Encuadre ROBUSTO por percentiles (coordenadas erróneas dentro de España existen
      // de verdad en el origen de datos): cuatro puntos malos no deben abrir el mapa a
      // todo el país. Los centros anómalos siguen dibujados; solo dejan de mandar en el
      // encuadre.
      const percentil = (xs: number[], q: number) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.max(0, Math.floor(q * (xs.length - 1))))];
      const lats = puntos.map((p) => p.lat);
      const lngs = puntos.map((p) => p.lng);
      const margen = puntos.length >= 20 ? 0.05 : 0;
      m.fitBounds(
        [
          [percentil(lats, margen), percentil(lngs, margen)],
          [percentil(lats, 1 - margen), percentil(lngs, 1 - margen)],
        ],
        { padding: [40, 40], maxZoom: 14 },
      );
    } catch (e) {
      console.error('[mapa] fallo al inicializar:', e);
      this.error.set(true);
    }
  }

  protected cerrar(): void {
    this.mapaLeaflet?.remove();
    this.mapaLeaflet = null;
    this.abierto.set(false);
  }

  private inyectarCssLeaflet(): void {
    if (cssLeafletInyectado) return;
    cssLeafletInyectado = true;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://unpkg.com/leaflet@${VERSION_LEAFLET}/dist/leaflet.css`;
    this.document.head.appendChild(link);
  }
}

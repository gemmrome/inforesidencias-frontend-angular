import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { numES } from '../../shared/util/formato';

interface Resultado {
  centroId: number;
  nombre: string;
  tipologia: string;
  poblacion: string;
  provincia: string;
  ruta: string;
}

interface Zona {
  tipo: 'poblacion' | 'comarca' | 'provincia';
  nombre: string;
  contexto: string;
  centros: number;
  ruta: string;
}

interface Interpretacion {
  url: string | null;
  capa: 'reglas' | 'ia';
  interpretacion: {
    zona: string | null;
    facetas: string[];
    precioMax: number | null;
    tipologia: string | null;
  };
}

const ETIQUETA_ZONA: Record<Zona['tipo'], string> = { poblacion: 'Población', comarca: 'Comarca', provincia: 'Provincia' };

const ETIQUETA_FACETA: Record<string, string> = {
  'unidad-demencia': 'unidad de demencia',
  'sin-sujeciones': 'sin sujeciones',
  concertada: 'plazas concertadas',
  'medico-propio': 'médico propio',
  'enfermeria-propia': 'enfermería propia',
  'silla-ruedas': 'adaptadas a silla de ruedas',
  encamados: 'que admiten encamados',
  'acreditada-dependencia': 'acreditadas ley de dependencia',
  'certificado-calidad': 'con certificado de calidad',
};

/** Frase legible de lo que se ha entendido: "en Sabadell · unidad de demencia · hasta 2.000 €/mes" */
function resumirInterpretacion(i: Interpretacion['interpretacion']): string {
  const partes: string[] = [];
  if (i.zona) partes.push(`en ${i.zona}`);
  for (const f of i.facetas) partes.push(ETIQUETA_FACETA[f] ?? f);
  if (i.precioMax) partes.push(`hasta ${numES(i.precioMax)} €/mes`);
  return partes.join(' · ');
}

/**
 * Búsqueda de texto libre sobre /api/v1/centros/buscar (herramienta pública AI-First).
 * Portado de src/components/buscador/BusquedaLibre.tsx. Devuelve DOS grupos: **zonas**
 * (población/comarca/provincia, que es lo que la mayoría busca) y **centros** por
 * nombre. Navegación completa por teclado (↑ ↓ Enter Esc).
 */
@Component({
  selector: 'ir-busqueda-libre',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './busqueda-libre.component.html',
})
export class BusquedaLibreComponent {
  readonly tipologia = input<string>();
  /** Si se indica, el input se envía con ese nombre (uso dentro de un <form>). */
  readonly name = input<string>();
  readonly placeholder = input('Población, provincia, código postal o nombre del centro…');

  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contenedorRef = viewChild<ElementRef<HTMLDivElement>>('contenedor');

  protected readonly etiquetaZona = ETIQUETA_ZONA;
  protected readonly resumirInterpretacion = resumirInterpretacion;

  protected readonly consulta = signal('');
  protected readonly zonas = signal<Zona[]>([]);
  protected readonly interp = signal<Interpretacion | null>(null);
  protected readonly resultados = signal<Resultado[]>([]);
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly activo = signal(-1);

  private debounce: ReturnType<typeof setTimeout> | undefined;

  // Lista plana para el teclado: zonas primero, luego centros.
  protected readonly opciones = computed<{ clave: string; ruta: string }[]>(() => [
    ...(this.interp()?.url ? [{ clave: 'interp', ruta: this.interp()!.url! }] : []),
    ...this.zonas().map((z) => ({ clave: `z-${z.ruta}`, ruta: z.ruta })),
    ...this.resultados().map((r) => ({ clave: `c-${r.tipologia}-${r.centroId}`, ruta: r.ruta })),
  ]);

  protected readonly desplazamiento = computed(() => (this.interp()?.url ? 1 : 0));

  constructor() {
    const cerrar = (e: MouseEvent) => {
      const el = this.contenedorRef()?.nativeElement;
      if (!el?.contains(e.target as Node)) this.abierto.set(false);
    };
    this.document.addEventListener('mousedown', cerrar);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('mousedown', cerrar);
      clearTimeout(this.debounce);
    });
  }

  protected itemCss(i: number): string {
    return `block px-4 py-2.5 ${this.activo() === i ? 'bg-superficie' : 'hover:bg-superficie'}`;
  }

  protected onInput(e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.consulta.set(valor);
    clearTimeout(this.debounce);

    if (valor.trim().length < 2) {
      this.zonas.set([]);
      this.resultados.set([]);
      this.interp.set(null);
      this.abierto.set(false);
      return;
    }

    this.cargando.set(true);
    this.debounce = setTimeout(() => this.buscar(valor.trim()), 250);
  }

  private async buscar(consulta: string): Promise<void> {
    try {
      const params: Record<string, string> = { q: consulta, limite: '6' };
      const tipologia = this.tipologia();
      if (tipologia) params['tipologia'] = tipologia;
      // La interpretación (capas 1-2) solo se pide para FRASES: un término suelto ya lo
      // resuelve el índice y no merece una llamada extra.
      const esFrase = consulta.split(/\s+/).length >= 3;

      const [datos, datosInterp] = await Promise.all([
        firstValueFrom(this.http.get<{ zonas?: Zona[]; resultados?: Resultado[] }>('/api/v1/centros/buscar', { params })),
        esFrase
          ? firstValueFrom(this.http.get<Interpretacion>('/api/v1/centros/interpretar', { params: { q: consulta } })).catch(() => null)
          : Promise.resolve(null),
      ]);

      this.zonas.set(datos.zonas ?? []);
      this.resultados.set(datos.resultados ?? []);
      this.abierto.set(true);
      this.activo.set(-1);
      this.interp.set(datosInterp?.url ? datosInterp : null);
    } finally {
      this.cargando.set(false);
    }
  }

  protected onFocus(): void {
    if (this.opciones().length > 0) this.abierto.set(true);
  }

  protected teclado(e: KeyboardEvent): void {
    const opciones = this.opciones();
    if (!this.abierto() || opciones.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activo.set((this.activo() + 1) % opciones.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activo.set(this.activo() <= 0 ? opciones.length - 1 : this.activo() - 1);
    } else if (e.key === 'Enter' && this.activo() >= 0) {
      e.preventDefault();
      this.document.defaultView?.location.assign(opciones[this.activo()].ruta);
    } else if (e.key === 'Escape') {
      this.abierto.set(false);
    }
  }
}

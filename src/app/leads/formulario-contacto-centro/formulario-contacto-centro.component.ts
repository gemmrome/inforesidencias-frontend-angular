import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { PROVINCIAS_FORMULARIO, TEXTO_CONDICIONES_LEGALES, TEXTO_NEWSLETTER, TEXTO_PENSIUM } from '../../shared/leads/contrato';
import { RecaptchaComponent } from '../recaptcha/recaptcha.component';

type Motivo = 'Residencia' | 'Trabajar' | 'Servicios';
type EstadoEnvio = 'idle' | 'enviando' | 'ok' | 'error';

/**
 * "Pedir información a {centro}" — réplica del formulario del modal de producción
 * (`contacto.*`, ver `shared/leads/contrato.ts`). Envía a
 * `POST /api/puente/contactar-centro/{id}` (ya portado, `src/server/routes/api-puente.ts`).
 * Portado de src/components/leads/FormularioContactoCentro.tsx.
 *
 * El desplegable de motivo reproduce el original: Trabajar y Servicios no generan lead,
 * derivan a la bolsa (subdominio) y al registro de proveedores.
 */
@Component({
  selector: 'ir-formulario-contacto-centro',
  standalone: true,
  imports: [RecaptchaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './formulario-contacto-centro.component.html',
})
export class FormularioContactoCentroComponent {
  readonly idCentro = input.required<number>();
  readonly nombreCentro = input.required<string>();
  readonly tipologia = input.required<string>();

  protected readonly provincias = PROVINCIAS_FORMULARIO;
  protected readonly textoCondicionesLegales = TEXTO_CONDICIONES_LEGALES;
  protected readonly textoNewsletter = TEXTO_NEWSLETTER;
  protected readonly textoPensium = TEXTO_PENSIUM;

  protected readonly motivo = signal<Motivo>('Residencia');
  protected readonly estado = signal<EstadoEnvio>('idle');
  protected readonly mensaje = signal('');
  private token = '';

  protected onMotivo(e: Event): void {
    this.motivo.set((e.target as HTMLSelectElement).value as Motivo);
  }

  protected onToken(t: string): void {
    this.token = t;
  }

  protected async enviar(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const formulario = e.currentTarget as HTMLFormElement;
    this.estado.set('enviando');
    const datos = new FormData(formulario);
    if (this.token) datos.set('g-recaptcha-response', this.token);
    try {
      const res = await fetch(`/api/puente/contactar-centro/${this.idCentro()}`, { method: 'POST', body: datos });
      const r = (await res.json()) as { ok: boolean; mensaje?: string };
      this.estado.set(r.ok ? 'ok' : 'error');
      this.mensaje.set(r.mensaje ?? '');
    } catch {
      this.estado.set('error');
      this.mensaje.set('No se pudo enviar. Inténtalo de nuevo.');
    }
  }
}

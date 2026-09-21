import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';

import { ConfigClienteService } from '../../core/config-cliente';

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void },
      ) => number;
    };
    __onloadRecaptcha?: () => void;
  }
}

type EstadoRecaptcha = 'pendiente' | 'cargando' | 'listo' | 'error';

/**
 * reCAPTCHA v2 con carga BAJO DEMANDA (docs/15: nada de terceros antes de que hagan
 * falta): el script solo se inyecta cuando el contenedor entra en el viewport. Portado
 * de src/components/leads/Recaptcha.tsx.
 *
 * La sitekey llega por `ConfigClienteService` (TransferState desde el servidor, ver
 * `src/app/core/config-cliente.ts`), no por una variable de entorno de build — en
 * Angular no existe el equivalente de `NEXT_PUBLIC_*`.
 *
 * `afterNextRender`: todo esto es DOM puro (`IntersectionObserver`, `window.grecaptcha`)
 * y no debe ejecutarse durante el renderizado en servidor.
 */
@Component({
  selector: 'ir-recaptcha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recaptcha.component.html',
})
export class RecaptchaComponent {
  readonly token = output<string>();

  private readonly siteKey = inject(ConfigClienteService).valores.recaptchaSiteKey;
  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');

  protected readonly estado = signal<EstadoRecaptcha>('pendiente');

  constructor() {
    afterNextRender(() => {
      const el = this.contenedor().nativeElement;
      const observer = new IntersectionObserver((entradas) => {
        if (!entradas.some((e) => e.isIntersecting) || this.estado() !== 'pendiente') return;
        this.estado.set('cargando');
        const renderizar = () => {
          try {
            window.grecaptcha!.render(el, {
              sitekey: this.siteKey,
              callback: (t) => this.token.emit(t),
              'expired-callback': () => this.token.emit(''),
            });
            this.estado.set('listo');
          } catch {
            this.estado.set('error');
          }
        };
        if (window.grecaptcha?.render) {
          renderizar();
        } else {
          window.__onloadRecaptcha = renderizar;
          const script = document.createElement('script');
          script.src = 'https://www.google.com/recaptcha/api.js?onload=__onloadRecaptcha&render=explicit';
          script.async = true;
          script.onerror = () => this.estado.set('error');
          document.head.appendChild(script);
        }
        observer.disconnect();
      });
      observer.observe(el);
    });
  }
}

import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfigClienteService } from '../../core/config-cliente';

/**
 * Carga el widget del chat (proyecto chat-bot) y NO pinta nada: el propio widget dibuja
 * su botón flotante. Portado de src/components/layout/CargadorChat.tsx.
 *
 * Integración tal como la documenta el widget: `<script … data-inforesidencias-chat>`
 * que se autoinicializa; la URL del WebSocket la deduce del origen del script.
 *
 * Carga cuando el navegador está ocioso → fuera de la ruta crítica, sin competir con el
 * LCP (docs/15). Sin `chatWidgetUrl` (antes `NEXT_PUBLIC_CHAT_WIDGET_URL`, ahora viaja
 * por `ConfigClienteService`) no hace nada.
 *
 * `afterNextRender` es el equivalente de Angular al `useEffect` original: solo se
 * ejecuta en el navegador tras la primera pintura, nunca durante el renderizado en el
 * servidor.
 */
let iniciada = false;

@Component({
  selector: 'ir-cargador-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cargador-chat.component.html',
})
export class CargadorChatComponent {
  private readonly config = inject(ConfigClienteService);

  constructor() {
    afterNextRender(() => {
      const widget = this.config.valores.chatWidgetUrl;
      if (!widget || iniciada) return;
      iniciada = true;
      const cargar = () => {
        const s = document.createElement('script');
        s.src = widget;
        s.async = true;
        s.setAttribute('data-inforesidencias-chat', '');
        s.setAttribute('data-title', 'Inforesidencias');
        s.setAttribute('data-subtitle', 'Te ayudamos a elegir centro');
        document.body.appendChild(s);
      };
      const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cargar);
      else setTimeout(cargar, 2000);
    });
  }
}

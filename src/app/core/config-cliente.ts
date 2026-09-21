import { inject, Injectable, InjectionToken, makeStateKey, TransferState } from '@angular/core';

import { RECAPTCHA_SITE_KEY_POR_DEFECTO } from '../shared/leads/contrato';

/**
 * Los pocos valores de configuración de servidor que un componente del NAVEGADOR
 * necesita conocer (la sitekey de reCAPTCHA es pública por naturaleza; el interruptor
 * de preproducción decide si se pintan los `PlaceholderBlock`; el ID de GTM decide si se
 * carga el contenedor). Nada sensible viaja por aquí — ninguna credencial de
 * `src/server/` cruza jamás esta frontera.
 *
 * Se transportan con `TransferState`, el mecanismo de Angular para pasar datos
 * calculados en el servidor al cliente sin que este tenga que recalcularlos ni
 * volver a pedirlos: el servidor los escribe una vez por petición (ver el provider en
 * `app.config.server.ts`) y quedan serializados en el HTML; el cliente los lee al
 * arrancar, ya hidratados.
 */
export interface ConfigCliente {
  preproduccion: boolean;
  recaptchaSiteKey: string;
  gtmId?: string;
  chatWidgetUrl?: string;
}

export const CONFIG_CLIENTE_KEY = makeStateKey<ConfigCliente>('ir-config-cliente');

/** Valores por defecto para cuando no hay TransferState (p. ej. pruebas unitarias). */
export const CONFIG_CLIENTE_POR_DEFECTO: ConfigCliente = {
  preproduccion: false,
  recaptchaSiteKey: RECAPTCHA_SITE_KEY_POR_DEFECTO,
};

export const CONFIG_CLIENTE = new InjectionToken<ConfigCliente>('CONFIG_CLIENTE');

@Injectable({ providedIn: 'root' })
export class ConfigClienteService {
  private readonly transferState = inject(TransferState);

  readonly valores: ConfigCliente = this.transferState.get(CONFIG_CLIENTE_KEY, CONFIG_CLIENTE_POR_DEFECTO);
}

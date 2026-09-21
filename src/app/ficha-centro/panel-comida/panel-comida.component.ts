import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ComidaCentro, MomentoComida } from '../../shared/dominio/comida.model';

const ETIQUETA_MOMENTO: Record<MomentoComida, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `2026-07-07` → `7 de julio de 2026`. Sin `Date`: la fecha la escribió el centro, no
 *  nosotros, y no hay que dejar que la zona horaria del navegador la mueva de día. */
function fechaLarga(iso: string): string {
  const [anyo, mes, dia] = iso.split('-');
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anyo}`;
}

/** `del 15 al 21 de junio de 2026`, no `del 15 de junio... al 21 de junio...`. */
function rangoFechas(desde: string, hasta: string): string {
  const [anyoD, mesD, diaD] = desde.split('-');
  const [anyoH, mesH] = hasta.split('-');
  if (anyoD === anyoH && mesD === mesH) return `del ${Number(diaD)} al ${fechaLarga(hasta)}`;
  return `del ${fechaLarga(desde)} al ${fechaLarga(hasta)}`;
}

/**
 * Lo que una residencia publica sobre su comida en «Aquí se come bien»: fotos de los
 * platos servidos, fotos de la cocina y los menús semanales en PDF. Portado de
 * src/components/ficha/PanelComida.tsx.
 *
 * La fecha va POR DELANTE y sin adjetivos (decisión PM, 2026-08-14): se muestra siempre
 * lo último publicado, sin umbral que esconda nada, y nunca se escribe "esta semana" ni
 * "reciente". Cada subbloque desaparece entero si está vacío.
 */
@Component({
  selector: 'ir-panel-comida',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-comida.component.html',
})
export class PanelComidaComponent {
  readonly comida = input.required<ComidaCentro>();
  readonly nombreCentro = input.required<string>();

  protected readonly etiquetaMomento = ETIQUETA_MOMENTO;
  protected readonly fechaLarga = fechaLarga;

  protected altFoto(momento: MomentoComida | undefined, texto: string | undefined): string {
    const momentoTxt = momento ? ETIQUETA_MOMENTO[momento] : null;
    return [momentoTxt, texto, this.nombreCentro()].filter(Boolean).join(' — ');
  }

  protected textoMenu(desde: string | undefined, hasta: string | undefined): string {
    return desde && hasta ? `Menú ${rangoFechas(desde, hasta)}` : 'Menú semanal';
  }
}

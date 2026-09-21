import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CargadorChatComponent } from '../cargador-chat/cargador-chat.component';
import { MenuMovilComponent } from '../menu-movil/menu-movil.component';

/**
 * Cabecera B2C por tarea (revision-plantillas §1.1, docs/08 §6.6): el familiar navega
 * por lo que busca; lo B2B vive bajo una entrada única "Para residencias". Portado de
 * src/components/layout/SiteHeader.tsx.
 *
 * Móvil (mobile-first): menú plegado en un `<details>` nativo, delegado en
 * `MenuMovilComponent` (necesita cerrarse al navegar, al tocar fuera y con Escape — ver
 * ese componente para el porqué completo, con el reporte de QA que lo destapó).
 */
const NAV = [
  { href: '/centros/buscador/residencias', etiqueta: 'Buscar centro' },
  { href: '/precios-residencias', etiqueta: 'Precios' },
  { href: '/residencias-mas-transparentes', etiqueta: 'Transparencia' },
] as const;

const EXTERNOS = [
  { href: 'https://www.inforesidencias.com/infoclasificados/lista-anuncios', etiqueta: 'Para residencias' },
  { href: 'https://www.inforesidencias.com/login', etiqueta: 'Área privada' },
  { href: 'https://www.inforesidencias.com/registrarse', etiqueta: 'Registrarse' },
] as const;

@Component({
  selector: 'ir-site-header',
  standalone: true,
  imports: [RouterLink, MenuMovilComponent, CargadorChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.component.html',
})
export class SiteHeaderComponent {
  protected readonly nav = NAV;
  protected readonly externos = EXTERNOS;
}

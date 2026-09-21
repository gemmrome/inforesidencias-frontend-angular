import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Landing de búsqueda proactiva — pantalla completa, SIN cabecera ni pie (decisión PM
 * 2026-08-06, docs/27 §E-2, docs/28 §3.1): es el único punto de carga del formulario
 * proactivo (ver EnlaceProactivaComponent para el porqué completo). Por eso esta
 * ruta NO cuelga de `SiteShellComponent` en `app.routes.ts`.
 *
 * NOTA DE MIGRACIÓN: esta es una versión mínima (placeholder) para que la app sea
 * ejecutable de punta a punta. El formulario proactivo real
 * (`FormularioProactivo`/`FormularioProactivoV2` en el original, con las preguntas de
 * perfil de `shared/leads/perfil-necesidades.ts` y el envío a `/api/puente/proactivo`)
 * está pendiente — tarea 7 "Portar leads y formularios".
 */
@Component({
  selector: 'ir-buscamos-por-ti-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './buscamos-por-ti.component.html',
})
export class BuscamosPorTiPageComponent {}

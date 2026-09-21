/**
 * Contrato AJENO: las filas tal y como las devuelve PostgREST del proyecto hermano
 * «Aquí se come bien» (Supabase autoalojado). Portado literal de
 * src/lib/api/comida/types.ts. Nombres en `snake_case` porque son los suyos.
 *
 * ESTOS TIPOS NO CRUZAN EL ADAPTADOR — misma regla que `api/types.ts`. Solo se declaran
 * las columnas que se piden, por lista blanca explícita (`?select=`). Deliberadamente
 * NO existen aquí `latitude`, `longitude` ni `ai_nutrition_analysis`.
 */

/** Una foto de una comida servida. Tabla `fotos_diarias`. */
export interface FotoDiariaRow {
  id: string;
  /** `desayuno` | `comida` | `cena`. Lo elige la PERSONA que sube la foto, no la IA. */
  meal_type: string | null;
  /** Fecha y hora reales de la comida (no la de subida). */
  taken_at: string;
  image_url: string;
  thumbnail_url: string | null;
  /** Descripción escrita a mano. Publicable. */
  description: string | null;
  /** Corrección de la cocinera sobre lo que dijo la IA. Publicable. */
  user_corrected_description: string | null;
  /** Nombre del plato GENERADO POR IA. Se recibe para poder decidir, pero el adaptador
   *  NO lo publica: nadie lo ha revisado. */
  food_name_es: string | null;
}

/** Un menú semanal. Tabla `menus_semanales`. */
export interface MenuSemanalRow {
  id: string;
  /** PDF original. Es lo que se enlaza. */
  pdf_url: string | null;
  /** Imagen de previsualización (primera página). No se pinta. */
  file_url: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

/** Una sección temática de la residencia. Tabla `secciones_residencia`.
 *  Solo interesa `cocina`, y de su `content` JSONB solo el array `photoPaths`. */
export interface SeccionResidenciaRow {
  section_type: string;
  content: { photoPaths?: unknown } | null;
}

/**
 * Qué vídeos de un centro sabe pintar el clon HOY. Portado literal de
 * src/lib/video/embebible.ts. Solo se pintan vídeos de YouTube (`embed/…`): Vimeo y
 * Matterport se descartan a propósito (no se anuncia lo que no se sabe mostrar — ver la
 * cabecera del fichero original para la medición completa, docs/34 §7).
 */

/** El identificador de un vídeo de YouTube, o `null` si la URL no lo es. */
export function idYoutube(url: string): string | null {
  return /embed\/([\w-]{6,})/.exec(url)?.[1] ?? null;
}

/** ¿El clon sabe pintar este vídeo? Si no, no se cuenta y no se anuncia. */
export function esVideoEmbebible(url: string): boolean {
  return idYoutube(url) !== null;
}

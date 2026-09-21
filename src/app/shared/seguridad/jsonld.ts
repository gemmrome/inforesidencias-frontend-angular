/**
 * Serialización segura de bloques JSON-LD (docs/23 §C-7). Portado literal de
 * src/lib/jsonld.ts.
 *
 * `JSON.stringify` NO escapa `<`, así que un nombre de centro que contenga `</script>`
 * cierra la etiqueta y rompe la página (y, con `'unsafe-inline'` en la CSP, es un vector
 * de inyección). Escapar `<`, `>` y `&` con secuencias unicode es válido en JSON y en
 * JavaScript, y ningún consumidor de JSON-LD lo nota.
 *
 * En Angular se usa igual que en Next: el componente pasa el JSON-LD ya serializado a
 * `[innerHTML]` de un `<script type="application/ld+json">`, con `DomSanitizer.bypassSecurityTrustHtml`
 * SOLO sobre el resultado de esta función (nunca sobre datos crudos).
 */
export function jsonLdSeguro(dato: unknown): string {
  return JSON.stringify(dato)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

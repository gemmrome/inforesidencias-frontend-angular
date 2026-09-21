import '../server-only';

import sanitize from 'sanitize-html';

/**
 * Saneado del HTML editorial (`seoDescriptionExt`) antes de renderizarlo en la ficha.
 * Portado LITERAL de src/lib/sanitize.ts.
 *
 * ANTES eran cuatro expresiones regulares que solo cubrían atributos de evento ENTRE
 * COMILLAS — verificado en docs/23 §A-2 como XSS almacenada explotable. Se delega en
 * `sanitize-html`, que parsea el documento y aplica LISTA BLANCA.
 *
 * En Angular, el resultado de esta función es lo ÚNICO que puede pasar por
 * `DomSanitizer.bypassSecurityTrustHtml()` en el componente de ficha — nunca el HTML
 * crudo de la API. Se ejecuta en el servidor (aquí) antes de que el HTML llegue al
 * cliente, exactamente igual que en el original.
 */
const OPCIONES: sanitize.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    '*': ['lang'],
  },
  // Sin data: ni javascript: — solo esquemas de navegación legítimos.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  // Enlaces de terceros en contenido de terceros: nunca sin rel de seguridad.
  transformTags: {
    a: sanitize.simpleTransform('a', { rel: 'nofollow ugc noopener' }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, OPCIONES);
}

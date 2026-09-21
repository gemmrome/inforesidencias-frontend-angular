/**
 * Qué imágenes puede servir optimizadas la app (portado de src/lib/imagenes.ts).
 *
 * En el original, `next.config.ts` solo autorizaba dos orígenes de `next/image`
 * (remotePatterns): las imágenes del monolito y las fotos de comida de «Aquí se come
 * bien». Angular no tiene un optimizador de imágenes con "remote patterns" equivalente
 * a `next/image`; la directiva `NgOptimizedImage` sí soporta un `loader` propio, pero
 * SOLO sabe optimizar imágenes de un origen que tú controles (no reescribe URLs
 * arbitrarias de terceros). Por eso esta guarda conserva el mismo papel que tenía:
 * decide qué URLs pueden pasar por `NgOptimizedImage` (con `ngSrc`) y cuáles caen a un
 * `<img>` normal sin optimizar pero funcional.
 *
 * ESTA LISTA es la MISMA decisión que antes vivía repetida en `next.config.ts`: aquí
 * queda en un solo sitio.
 */
const HOSTS_OPTIMIZABLES = [
  'https://www.inforesidencias.com/resources/',
  'https://pub-eae991d434be4ed8beb1ef275962e687.r2.dev/residencias/',
];

export function esImagenOptimizable(url: string): boolean {
  return HOSTS_OPTIMIZABLES.some((prefijo) => url.startsWith(prefijo));
}

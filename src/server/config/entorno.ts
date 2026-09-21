import '../server-only';

/**
 * Entorno de ejecución del clon. ÚNICA fuente de verdad sobre "dónde estoy corriendo".
 * Portado LITERAL de src/lib/config/entorno.ts — la lógica y la regla de negocio no
 * cambian nada al pasar de Next a Express: sigue siendo `process.env` leído en el
 * servidor Node.
 *
 * Por qué existe (2026-08-06): hasta ahora el entorno se deducía de variables sueltas
 * que había que acordarse de poner bien en cada máquina. El riesgo concreto: un
 * `robots.ts` que respondiera `allow: "/"` SIEMPRE dejaría un clon completo del sitio
 * —miles de fichas— abierto a los buscadores como contenido duplicado del original.
 *
 * La regla: lo indexable, la analítica real y los envíos reales son privilegios de
 * PRODUCCIÓN, y se conceden solo si alguien lo declara explícitamente. El valor por
 * defecto (variable ausente o con cualquier otro contenido) es el seguro.
 */

export type Entorno = 'desarrollo' | 'preproduccion' | 'produccion';

function leerEntorno(): Entorno {
  switch (process.env['APP_ENTORNO']) {
    case 'produccion':
      return 'produccion';
    case 'preproduccion':
      return 'preproduccion';
    case 'desarrollo':
      return 'desarrollo';
    default:
      // Sin declarar: NODE_ENV distingue el portátil del resto, pero nunca concede
      // producción. Un servidor mal configurado se comporta como preproducción.
      return process.env['NODE_ENV'] === 'production' ? 'preproduccion' : 'desarrollo';
  }
}

export const ENTORNO: Entorno = leerEntorno();

/** Solo aquí se indexa, se mide con la analítica real y se envían leads de verdad. */
export const ES_PRODUCCION = ENTORNO === 'produccion';

/**
 * ¿Puede este despliegue aparecer en buscadores? Gobierna TANTO `robots.txt` (ver
 * `src/server/routes/robots.ts`) COMO la cabecera `X-Robots-Tag` que añade
 * `src/server.ts` a toda respuesta — la cabecera es la que de verdad vincula a Google y
 * Bing; `robots.txt` solo es una petición educada. Defensa en capas, no una sola valla.
 */
export const ES_INDEXABLE = ES_PRODUCCION;

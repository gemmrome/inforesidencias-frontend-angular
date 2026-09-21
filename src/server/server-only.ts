/**
 * Equivalente del paquete `server-only` que usaba el original (Next.js). Angular no
 * tiene un mecanismo de build que impida importar un módulo desde el navegador, así que
 * esta guarda hace en TIEMPO DE EJECUCIÓN lo que allí hacía el bundler en tiempo de
 * build: si este módulo se ejecuta donde existe `window`, lanza.
 *
 * TODO lo que cuelga de `src/server/` importa esto como primera línea, exactamente con
 * el mismo criterio que el original marcaba con `import "server-only"`: credenciales de
 * API, el cliente HTTP con reintentos, los adaptadores anticorrupción, el índice en
 * memoria (lee del disco del servidor) y el puente de leads. Ninguno de estos ficheros
 * debe entrar jamás en el bundle del navegador — la frontera real la impone que
 * `src/app/` (código de navegador) nunca importa nada de `src/server/`; esta guarda es
 * la red de seguridad por si algún día alguien se equivoca.
 */
if (typeof window !== 'undefined') {
  throw new Error(
    'Módulo de src/server/ importado en el navegador. Esto es exactamente lo que "server-only" ' +
      'impedía en el proyecto Next: revisa el import que ha traído este fichero al bundle del cliente.',
  );
}

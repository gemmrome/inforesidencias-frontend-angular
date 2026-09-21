/**
 * Interruptor de los restos de preproducción (docs/23 §A-6). Portado de
 * src/lib/preproduccion.ts.
 *
 * `PREPRODUCCION=1` en el entorno del servidor muestra los `PlaceholderBlock` ámbar y el
 * pie "Página servida por el frontend en preproducción". Cualquier otro valor (o
 * ausencia) los oculta — comportamiento seguro por defecto.
 *
 * DIFERENCIA CON EL ORIGINAL: en Next, `NEXT_PUBLIC_PREPRODUCCION` se leía directamente
 * en un Client Component porque Next INYECTA LAS VARIABLES `NEXT_PUBLIC_*` EN EL BUNDLE
 * DEL NAVEGADOR en tiempo de build. Angular no tiene ese mecanismo (y no debería
 * imitarlo con una recompilación por entorno: este proyecto se despliega con releases
 * inmutables, `scripts/desplegar.sh`, configuradas por variables de servidor, no por
 * build distinto por entorno). Por eso este valor se lee aquí, en el servidor, y viaja
 * al componente Angular vía `TransferState` — ver `src/app/core/config-cliente.ts` y el
 * provider en `src/app/app.config.server.ts` que lo escribe en cada petición.
 */
export const PREPRODUCCION = process.env['PREPRODUCCION'] === '1';

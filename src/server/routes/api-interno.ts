import { Router } from 'express';

import { invalidarCacheSitemap } from '../indice/sitemap';

/**
 * POST /api/interno/revalidar — invalidación tras una sincronización del índice.
 * Portado de src/app/api/interno/revalidar/route.ts.
 *
 * DIFERENCIA CON EL ORIGINAL: allí `revalidateTag("indice", "max")` invalidaba las
 * entradas cacheadas por Next Cache Components etiquetadas "indice". Aquí no existe ese
 * mecanismo, pero tampoco hace tanta falta: `src/server/indice/store.ts` ya se
 * refresca solo en cuanto cambia el `mtime` del fichero del índice (no hace falta avisarle),
 * y el resto de cachés derivadas (`memoPorVersion` en geo/estadisticas/miembros) se
 * invalidan solas porque su clave incluye la versión del índice (`metaIndice().generado`).
 * Lo ÚNICO que de verdad se beneficia de un aviso explícito es la caché de sitemaps
 * (TTL de 1 día): sin este endpoint, un centro nuevo tardaría hasta 24h en aparecer en
 * el sitemap en vez de al momento. Sigue protegido por el mismo secreto de entorno.
 */
export const apiInterno = Router();

apiInterno.post('/revalidar', (req, res) => {
  const esperado = process.env['REVALIDAR_TOKEN'];
  if (!esperado) {
    res.status(503).json({ ok: false, error: 'REVALIDAR_TOKEN no configurado en el servidor' });
    return;
  }
  const recibido = req.headers['x-token'];
  if (!recibido || recibido !== esperado) {
    res.status(401).json({ ok: false, error: 'no autorizado' });
    return;
  }

  invalidarCacheSitemap();
  res.json({ ok: true, etiqueta: 'indice', momento: new Date().toISOString() });
});

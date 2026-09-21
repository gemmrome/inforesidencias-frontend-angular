import { Router } from 'express';

import { enviarContactoCentro, enviarBusquedaProactiva } from '../leads/puente';
import { esAccionFicha, registrarInteraccionCentro } from '../estadisticas/interacciones';

/**
 * `/api/puente/*` — puente TEMPORAL de leads y estadísticas al monolito (docs/12).
 * Portado de src/app/api/puente/**\/route.ts. Los formularios envían `application/x-www-
 * form-urlencoded` (igual que en el original, que leía `req.formData()`); Express lo
 * parsea con `express.urlencoded()`, montado en `server.ts` antes de este router.
 */
export const apiPuente = Router();

apiPuente.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

function camposDeCuerpo(body: unknown): Record<string, string> {
  const campos: Record<string, string> = {};
  if (body && typeof body === 'object') {
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (typeof v === 'string') campos[k] = v;
    }
  }
  return campos;
}

/** POST /api/puente/contactar-centro/:id — formulario "Pedir información" de la ficha. */
apiPuente.post('/contactar-centro/:id', async (req, res) => {
  const idCentro = Number(req.params['id']);
  if (!Number.isInteger(idCentro) || idCentro <= 0) {
    res.status(400).json({ ok: false, mensaje: 'Id de centro inválido.' });
    return;
  }
  const campos = camposDeCuerpo(req.body);

  for (const requerido of ['contacto.nombre', 'contacto.email', 'contacto.telefono', 'contacto.provincia', 'contacto.mensaje']) {
    if (!campos[requerido]?.trim()) {
      res.status(400).json({ ok: false, mensaje: `Falta el campo ${requerido}.` });
      return;
    }
  }
  if (campos['condicionesLegales'] !== '1') {
    res.status(400).json({ ok: false, mensaje: 'Debes aceptar las condiciones legales.' });
    return;
  }

  const resultado = await enviarContactoCentro(idCentro, campos);
  res.status(resultado.ok ? 200 : 502).json(resultado);
});

/**
 * POST /api/puente/interaccion-centro/:id/:accion — clics "Ver teléfono"/"Ver web".
 * Responde SIEMPRE 204 y sin cuerpo: lo llama un `sendBeacon`, que no lee la respuesta.
 */
apiPuente.post('/interaccion-centro/:id/:accion', async (req, res) => {
  const idCentro = Number(req.params['id']);
  const accion = req.params['accion'];
  if (Number.isInteger(idCentro) && idCentro > 0 && esAccionFicha(accion)) {
    await registrarInteraccionCentro(idCentro, accion);
  }
  res.status(204).end();
});

/** POST /api/puente/proactivo — formulario "Te asesoramos" (búsqueda proactiva). */
apiPuente.post('/proactivo', async (req, res) => {
  const campos = camposDeCuerpo(req.body);

  for (const requerido of [
    'buscadorProactivo.tipologia', 'buscadorProactivo.personaEdad',
    'buscadorProactivo.personaCuando', 'buscadorProactivo.personaNecesidades',
    'buscadorProactivo.contactoPersona', 'buscadorProactivo.contactoTelefono',
    'buscadorProactivo.contactoEmail', 'buscadorProactivo.contactoHorario',
    'buscadorProactivo.contactoComoNosHasConocido',
  ]) {
    if (!campos[requerido]?.trim()) {
      res.status(400).json({ ok: false, mensaje: `Falta el campo ${requerido}.` });
      return;
    }
  }
  if (campos['condicionesLegales'] !== '1') {
    res.status(400).json({ ok: false, mensaje: 'Debes aceptar las condiciones legales.' });
    return;
  }
  // Honeypots de producción: si vienen rellenos es un bot — respuesta neutra sin reenviar.
  if (campos['nombre-control']?.trim() || campos['email-control']?.trim()) {
    res.json({ ok: true, modo: 'descartado', mensaje: 'Enviado.' });
    return;
  }
  campos['busquedaProactiva'] = 'true';

  const resultado = await enviarBusquedaProactiva(campos);
  res.status(resultado.ok ? 200 : 502).json(resultado);
});

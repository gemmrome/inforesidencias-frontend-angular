import { Router } from 'express';

import { getCentro, TIPOS_FICHA } from '../adapter/centro';
import { comidaDeCentro } from '../adapter/comida';
import { valorSinRepetirEtiqueta } from '../adapter/etiquetas';
import { slugGeo } from '../indice/geo';
import { rutasCanonicasDeFicha } from '../indice/store';
import { miembrosSugeridos, urlAltaCentro } from '../indice/miembros';
import { sanitizeHtml } from '../seguridad/sanitize';
import { tieneComida } from '../../app/shared/dominio/comida.model';
import type { Centro } from '../../app/shared/dominio/centro.model';
import { pestanasDeGaleria } from '../../app/shared/galeria/pestanas';
import { esVideoEmbebible } from '../../app/shared/video/embebible';
import { numES } from '../../app/shared/util/formato';
import { TIPOLOGIAS_RUTA } from '../../app/shared/indice/tipos';
import type {
  EnlacesZona,
  MigaFicha,
  RespuestaFichaCentro,
} from '../../app/shared/ficha-centro/ficha-centro.model';

/**
 * Ficha de centro (tarea 6, MIGRACION.md). Portado de
 * src/app/(sitio)/centros/[tipo]/[id]/page.tsx (redirección canónica) y
 * .../[slug]/page.tsx (852 líneas, la ficha en sí).
 *
 * DOS PIEZAS, como en el resto del proyecto:
 *
 *  - `fichaCentroPaginas` (montado en la RAÍZ, antes del estático y del catch-all de
 *    Angular en `server.ts`): resuelve existencia y canonicidad y devuelve un 404 o un
 *    308 REALES — exactamente lo que el original perseguía con `instant = false` y sus
 *    `generateStaticParams` mínimos (ver los comentarios larguísimos del original: un
 *    router de Next con PPR emitía 200 antes de poder redirigir/404). Aquí no hace
 *    falta ningún truco: Express nunca "prerenderiza" nada, así que un `res.redirect`/
 *    `res.status(404)` de toda la vida ya es el estado HTTP real. Solo cuando la URL es
 *    la canónica se llama a `next()` para que Angular SSR pinte `FichaCentroPageComponent`.
 *
 *  - `fichaCentroApi` (`GET /api/v1/ficha-centro`, montado bajo `/api/v1` como
 *    `listado.ts`/`home.ts`): hace el mismo cálculo que `Ficha()`/`centroDeParams()` del
 *    original y lo sirve como JSON; el componente Angular solo pide y pinta.
 *
 * La comprobación de canonicidad de `fichaCentroPaginas` usa el ÍNDICE LOCAL
 * (`rutasCanonicasDeFicha`, síncrono) para la ruta con slug — igual que el original
 * (`resolucionFicha`): una ficha que la API sirva pero que aún no esté en el índice da
 * 404 hasta la siguiente sync (riesgo aceptado y anotado también allí). La ruta SOLO
 * con id (sin slug) sí llama a la API en vivo (`getCentro`), también igual que el
 * original: es la vía de recuperación de una URL antigua/rota, no la que ve cada visita.
 */
export const fichaCentroPaginas = Router();
export const fichaCentroApi = Router();

fichaCentroApi.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

const SITE = process.env['SITE_URL'] ?? 'https://www.inforesidencias.com';

/** true solo si tipo/id tienen la FORMA de una ficha — deja pasar cualquier otra cosa
 *  (`/centros/buscador/...`, `/centros/directorio/...`, rutas futuras) sin tocarla. */
function esRutaDeFicha(tipo: string, id: string): boolean {
  if (!TIPOS_FICHA.includes(tipo)) return false;
  const idNum = Number(id);
  return Number.isInteger(idNum) && idNum > 0;
}

/** Ruta del buscador geográfico para la tipología del centro (subtipos → directorio). */
function rutaBuscador(centro: Centro): string {
  const entrada = Object.entries(TIPOLOGIAS_RUTA).find(([, t]) => t.cod === centro.tipologiaCod);
  return entrada?.[0] ?? 'directorio';
}

/** "dd-mm-yyyy [hh:mm]" de la API → ISO; null si no es el formato esperado. */
function fechaIso(fecha: string | undefined): string | null {
  const m = fecha?.match(/^(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function fechaLegible(fecha: string | undefined): string | null {
  const iso = fechaIso(fecha);
  return iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
}

function tituloPaginaDe(centro: { nombre: string; tipologia: string; contacto: { poblacion: { nombre: string; provincia: string } } }): string {
  const lugar = `${centro.contacto.poblacion.nombre} (${centro.contacto.poblacion.provincia})`;
  return `${centro.nombre} — ${centro.tipologia} en ${lugar} | Inforesidencias`;
}

function migaFichaDe(centro: Centro): MigaFicha {
  const { comunidad, provincia, nombre } = centro.contacto.poblacion;
  const base = `/centros/buscador/${rutaBuscador(centro)}`;
  return {
    comunidad: { texto: comunidad, href: `${base}/${slugGeo(comunidad)}` },
    provincia: { texto: provincia, href: `${base}/${slugGeo(comunidad)}/${slugGeo(provincia)}` },
    poblacion: { texto: nombre, href: `${base}/${slugGeo(comunidad)}/${slugGeo(provincia)}/${slugGeo(nombre)}` },
  };
}

/** JSON-LD (nivel ULPM, docs/03 §6.8): NursingHome/LocalBusiness + BreadcrumbList. */
function jsonLd(centro: Centro): object[] {
  const url = `${SITE}/centros/${centro.tipologiaRuta}/${centro.id}/${centro.slug}`;
  const buscador = rutaBuscador(centro);
  const imagenes = centro.recursos.filter((g) => g.ambito === 'imagenes').flatMap((g) => g.recursos.map((r) => r.url));
  const logo = centro.recursos.find((g) => g.ambito === 'logos')?.recursos[0]?.url;
  const precios = (centro.precios?.habitaciones ?? []).map((h) => h.precio).filter((p): p is number => p !== undefined);
  const esResidencial = centro.tipologiaRuta === 'residencia';
  const { comunidad, provincia, nombre: poblacion } = centro.contacto.poblacion;
  return [
    {
      '@context': 'https://schema.org',
      '@type': esResidencial ? ['NursingHome', 'LocalBusiness'] : 'LocalBusiness',
      '@id': url,
      name: centro.nombre,
      url,
      telephone: centro.contacto.telefono,
      slogan: centro.eslogan,
      logo,
      priceRange: precios.length ? `${numES(Math.min(...precios))} € - ${numES(Math.max(...precios))} € /mes` : undefined,
      dateModified: fechaIso(centro.fechaActualizacion) ?? undefined,
      parentOrganization: centro.grupo ? { '@type': 'Organization', name: centro.grupo } : undefined,
      image: imagenes.length ? imagenes : undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: centro.contacto.direccion,
        addressLocality: poblacion,
        addressRegion: provincia,
        postalCode: centro.contacto.codigoPostal,
        addressCountry: 'Spain',
      },
      geo: centro.geo ? { '@type': 'GeoCoordinates', latitude: String(centro.geo.lat), longitude: String(centro.geo.lng) } : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Centros', item: `${SITE}/centros/buscador/` },
        { '@type': 'ListItem', position: 2, name: comunidad, item: `${SITE}/centros/buscador/${buscador}/${slugGeo(comunidad)}` },
        {
          '@type': 'ListItem',
          position: 3,
          name: poblacion,
          item: `${SITE}/centros/buscador/${buscador}/${slugGeo(comunidad)}/${slugGeo(provincia)}/${slugGeo(poblacion)}`,
        },
        { '@type': 'ListItem', position: 4, name: centro.nombre, item: url },
      ],
    },
  ];
}

function enlacesZonaDe(centro: Centro): EnlacesZona {
  const { provincia, nombre: poblacion } = centro.contacto.poblacion;
  const enlaces: EnlacesZona = {
    // Texto literal del original ("residencias"), sea cual sea la tipología real del
    // centro — se preserva tal cual, no es un error de este puerto.
    otrasEnPoblacion: { texto: `Otras residencias en ${poblacion}`, href: `${migaFichaDe(centro).poblacion.href}` },
  };
  if (centro.tipologiaRuta === 'residencia') {
    enlaces.preciosProvincia = { texto: `Precios de residencias en ${provincia}`, href: `/precios-residencias/${slugGeo(provincia)}` };
    enlaces.masTransparentesProvincia = {
      texto: `Las residencias más transparentes de ${provincia}`,
      href: `/residencias-mas-transparentes/${slugGeo(provincia)}`,
    };
  }
  return enlaces;
}

/** Cálculo completo de la ficha — el equivalente-dato de `Ficha()` en el original. */
async function calcularFicha(centro: Centro): Promise<RespuestaFichaCentro> {
  const jsonLdCentro = jsonLd(centro);
  const tituloPagina = tituloPaginaDe(centro);
  const migaFicha = migaFichaDe(centro);

  if (!centro.esMiembro) {
    const sugerencias = miembrosSugeridos(centro.id, centro.tipologiaCod);
    return {
      encontrado: true,
      esMiembro: false,
      centro: {
        nombre: centro.nombre,
        tipologia: centro.tipologia,
        direccion: centro.contacto.direccion,
        codigoPostal: centro.contacto.codigoPostal,
        poblacion: centro.contacto.poblacion.nombre,
        provincia: centro.contacto.poblacion.provincia,
        geo: centro.geo,
      },
      migaFicha,
      sugerencias,
      urlAlta: urlAltaCentro(centro.tipologiaCod, SITE),
      tituloPagina,
      jsonLd: jsonLdCentro,
    };
  }

  const imagenesRaw = centro.recursos.filter((g) => g.ambito === 'imagenes').flatMap((g) => g.recursos);
  const logo = centro.recursos.find((g) => g.ambito === 'logos')?.recursos[0]?.url;
  const direccionCompleta = `${centro.contacto.direccion}, ${centro.contacto.codigoPostal} ${centro.contacto.poblacion.nombre} (${centro.contacto.poblacion.provincia})`;
  // Solo los vídeos que el clon sabe pintar (~9 % del corpus es Vimeo/Matterport/MP4
  // propio): contar los que trae la API anunciaría una pestaña «Vídeos» vacía.
  const videosRaw = (centro.recursos.find((g) => g.ambito === 'videos')?.recursos ?? []).filter((v) => esVideoEmbebible(v.url));
  // Segundo origen («Aquí se come bien»): cero peticiones salvo miembro con vínculo verificado.
  const comida = await comidaDeCentro(centro.id, centro.esMiembro);
  const pestanas = pestanasDeGaleria({
    fotosCentro: imagenesRaw.length,
    hayComida: tieneComida(comida),
    videos: videosRaw.length,
  });

  const centroSaneado: Centro = {
    ...centro,
    descripcionHtml: centro.descripcionHtml ? sanitizeHtml(centro.descripcionHtml) : undefined,
  };

  return {
    encontrado: true,
    esMiembro: true,
    centro: centroSaneado,
    migaFicha,
    direccionCompleta,
    logo,
    grupoEtiqueta: centro.grupo ? valorSinRepetirEtiqueta('Grupo', centro.grupo) : undefined,
    imagenes: imagenesRaw.map((img, i) => ({
      url: img.url,
      alt: img.etiqueta ? `${img.etiqueta} — ${centro.nombre}` : centro.nombre,
      prioritaria: i === 0,
    })),
    videos: videosRaw.map((v) => ({ url: v.url, titulo: v.etiqueta ?? centro.nombre })),
    // Null y no el objeto crudo cuando está vacío: el cliente decide si pinta
    // `PanelComidaComponent` con `@if (d.comida; as comida)`, igual que el original
    // decidía si montaba `<PanelComida>` con `comida && tieneComida(comida)`.
    comida: tieneComida(comida) ? comida : null,
    pestanas,
    jsonLd: jsonLdCentro,
    tituloPagina,
    enlacesZona: enlacesZonaDe(centro),
    fechaActualizacionLegible: fechaLegible(centro.fechaActualizacion),
  };
}

// ------------------------------------------------------------------------------------
// Páginas: /centros/:tipo/:id (solo redirección) y /centros/:tipo/:id/:slug (la ficha)
// ------------------------------------------------------------------------------------

fichaCentroPaginas.get('/centros/:tipo/:id', async (req, res, next) => {
  const { tipo, id } = req.params;
  if (!esRutaDeFicha(tipo, id)) {
    next();
    return;
  }
  try {
    const centro = await getCentro(Number(id));
    if (!centro) {
      res.status(404).type('html').send(paginaNoEncontrada());
      return;
    }
    res.redirect(308, `/centros/${centro.tipologiaRuta}/${centro.id}/${centro.slug}`);
  } catch (e) {
    // No hay ninguna ruta de Angular para "/centros/:tipo/:id" (a propósito: nunca
    // pinta nada, solo redirige o da 404) — si se dejara caer con `next()`, un fallo
    // de la API dejaría una página en blanco con 200. Mejor un 502 explícito.
    console.error(`[ficha-centro] fallo resolviendo la redirección canónica de ${id}:`, e);
    res.status(502).type('html').send(paginaNoEncontrada());
  }
});

fichaCentroPaginas.get('/centros/:tipo/:id/:slug', (req, res, next) => {
  const { tipo, id, slug } = req.params;
  if (!esRutaDeFicha(tipo, id)) {
    next();
    return;
  }
  const candidatas = rutasCanonicasDeFicha().get(Number(id));
  if (!candidatas?.length) {
    res.status(404).type('html').send(paginaNoEncontrada());
    return;
  }
  const canonica = candidatas.find((c) => c.tipoRuta === tipo) ?? candidatas[0];
  if (canonica.tipoRuta !== tipo || canonica.slug !== slug) {
    res.redirect(308, `/centros/${canonica.tipoRuta}/${canonica.id}/${canonica.slug}`);
    return;
  }
  // Canónica: sigue hacia el estático/Angular SSR, que pinta FichaCentroPageComponent.
  next();
});

function paginaNoEncontrada(): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Centro no encontrado — Inforesidencias</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1f2933}
a{color:#1992d4}</style></head><body>
<h1>No hemos encontrado ese centro</h1>
<p>Puede que el enlace esté roto o que el centro ya no esté disponible.</p>
<p><a href="/centros/buscador/residencia">Buscar residencias y centros para mayores</a></p>
</body></html>`;
}

// ------------------------------------------------------------------------------------
// API: GET /api/v1/ficha-centro?tipo=&id=&slug=
// ------------------------------------------------------------------------------------

fichaCentroApi.get('/ficha-centro', async (req, res) => {
  const tipo = String(req.query['tipo'] ?? '');
  const id = String(req.query['id'] ?? '');
  if (!TIPOS_FICHA.includes(tipo)) {
    res.status(400).json({ error: `tipo desconocido; valores: ${TIPOS_FICHA.join(', ')}.` });
    return;
  }
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    res.status(400).json({ error: 'id inválido.' });
    return;
  }

  try {
    const centro = await getCentro(idNum);
    if (!centro) {
      res.json({ encontrado: false } satisfies RespuestaFichaCentro);
      return;
    }
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json(await calcularFicha(centro));
  } catch (e) {
    // Sin esto, un fallo de `getCentro` (API caída, credencial mal puesta…) queda como
    // una promesa rechazada sin capturar: Express 4 no llama a `next(err)` solo por
    // ser un handler `async`, así que la petición se queda colgada hasta que el SSR de
    // Angular agota su tiempo de estabilización ("Application did not stabilize").
    // Un 502 lo resuelve al instante, y `FichaCentroPageComponent` ya lo trata igual
    // que cualquier otro fallo de red (`catchError` → "No hemos podido cargar...").
    console.error(`[ficha-centro] fallo calculando la ficha ${idNum}:`, e);
    res.status(502).json({ encontrado: false } satisfies RespuestaFichaCentro);
  }
});

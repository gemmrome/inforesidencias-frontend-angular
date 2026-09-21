#!/usr/bin/env node
/**
 * Job de sincronización del índice de centros (ADR-0003, consecuencia declarada).
 *
 * Modos:
 *   node scripts/sync-indice.mjs full                      # carga nacional completa
 *   node scripts/sync-indice.mjs full --solo-provincia X   # smoke test limitado a una provincia
 *   node scripts/sync-indice.mjs incremental               # solo provincias con centros actualizados
 *   node scripts/sync-indice.mjs check                     # frescura: exit 1 si la última sync OK > 24 h
 *   node scripts/sync-indice.mjs enriquecer                # facetas por centro (RP-02 anexo) — RESUMABLE
 *   node scripts/sync-indice.mjs enriquecer --solo-provincia X   # smoke del enriquecimiento
 *   node scripts/sync-indice.mjs geo                       # coordenadas por centro — RESUMABLE
 *   node scripts/sync-indice.mjs geo --limite 20           # prueba de humo REAL (20 centros)
 *   node scripts/sync-indice.mjs actualizacion             # fecha de actualización por centro — RESUMABLE
 *
 * Opciones: --solo-provincia X (alias --provincia X) · --limite N · --todo
 * Un argumento desconocido ABORTA (exit 2): ver nota en parsearArgumentos().
 *
 * Salida: data/indice-centros.json (documentos) + data/indice-meta.json
 * (frescura y métricas). El directorio data/ NO se versiona: el índice es caché de la API,
 * la fuente de verdad sigue siendo el MySQL del backend.
 *
 * Descubrimiento de trabajo: POST /poblaciones/contador-centros-provincia por tipología
 * (10 llamadas) → solo se piden los pares provincia×tipología con centros > 0.
 * Incremental: GET /centros/ultimas-actualizaciones/{dd-mm-yyyy} → ids → se rehacen las
 * rebanadas (tipología×provincia) afectadas; ids desconocidos resuelven provincia vía
 * /centro/{id}/datos-generales + /poblaciones/poblacion/{idPoblacion}.
 */
import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync, openSync, closeSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = `${ROOT}/data`;
const FICHERO_DOCS = `${DATA_DIR}/indice-centros.json`;
const FICHERO_META = `${DATA_DIR}/indice-meta.json`;
// Caché de facetas por centro (modo enriquecer): sobrevive a las cargas full/incremental,
// que la re-aplican al reconstruir el índice.
const FICHERO_FACETAS = `${DATA_DIR}/facetas-centros.json`;

/**
 * Configuración: `.env.local` si existe, y SIEMPRE `process.env` por encima (docs/23 §A-5).
 * Antes se hacía `readFileSync(.env.local)` a secas y el script reventaba si el fichero no
 * estaba — justo el caso de un servidor con systemd/Docker, donde las variables vienen del
 * entorno. Sin esto no se puede programar el cron, que es P4 del registro de decisiones.
 * Se quitan además las comillas alrededor del valor (VAR="x" era un valor con comillas).
 */
function leerEnvLocal(ruta) {
  if (!existsSync(ruta)) return {};
  const pares = {};
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#") || !l.includes("=")) continue;
    const [clave, ...resto] = l.split("=");
    pares[clave.trim()] = resto.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return pares;
}
const env = { ...leerEnvLocal(`${ROOT}/.env.local`), ...process.env };
if (!env.API_KEY_API_IR) {
  console.error(
    "Falta API_KEY_API_IR. Defínela en el entorno (recomendado en servidor) o en .env.local (en la raíz del proyecto)."
  );
  process.exit(2);
}
const AUTH = "Basic " + Buffer.from(`Infoelder:${env.API_KEY_API_IR}`).toString("base64");
const UA = "InforesidenciasCloneSync/0.1 (gestion@inforesidencias.com)";
const BASE = env.API_IR_BASE_URL || "https://api.inforesidencias.com/api";

// El 13 se añadió el 2026-08-06: la API lo sirve (34 centros en 18 provincias, contados con
// /poblaciones/contador-centros-provincia) y producción lo lista en su menú de servicios.
// El 90 (salud mental) NO se añade: el mismo contador devuelve 0 centros.
const TIPOLOGIAS = { 1: "Residencia", 2: "Centro de día", 3: "Subtipo-3", 4: "Sociosanitario",
  5: "Subtipo-5", 6: "Tutela", 7: "Subtipo-7", 8: "Ayuda a domicilio", 9: "Subtipo-9", 10: "Teleasistencia",
  13: "Apartamentos con servicios" };

const THROTTLE_MS = 300;
const MAX_HORAS_FRESCURA = 24;
// Guardarraíl: una carga completa con menos documentos que esto NO sobrescribe el índice
// (protege contra fallos parciales de la API). El corpus real ronda los 9,3k.
const MINIMO_DOCS_FULL = 8000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------------ *
 * Escritura ATÓMICA y cerrojo (docs/23 §A-3)
 * ------------------------------------------------------------------------ */

/**
 * `writeFileSync` de 5,8 MB NO es atómico: si una petición del servidor lee el fichero a
 * medias, `JSON.parse` lanza y caen TODAS las páginas con un 500. Se escribe a un temporal
 * en el MISMO sistema de ficheros y se hace `rename()`, que sí es atómico en POSIX: el
 * lector ve el fichero viejo o el nuevo, nunca uno a medias.
 */
function escribirAtomico(fichero, contenido) {
  const tmp = `${fichero}.tmp-${process.pid}`;
  writeFileSync(tmp, contenido);
  renameSync(tmp, fichero);
}

const FICHERO_BLOQUEO = `${DATA_DIR}/sync.lock`;
// Una `full` completa tarda ~40 min; por encima de 3 h el proceso está muerto, no lento.
const BLOQUEO_CADUCA_MS = 3 * 60 * 60 * 1000;

/**
 * Cerrojo entre ejecuciones: la nocturna (full) y la horaria (incremental) se pisarían.
 * `openSync(..., "wx")` falla si el fichero existe → exclusión mutua sin condición de
 * carrera. Se detecta el bloqueo huérfano por antigüedad (un proceso muerto no lo libera).
 */
function tomarBloqueo(modo) {
  mkdirSync(DATA_DIR, { recursive: true });
  try {
    const fd = openSync(FICHERO_BLOQUEO, "wx");
    writeFileSync(fd, JSON.stringify({ modo, pid: process.pid, inicio: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const edad = Date.now() - statSync(FICHERO_BLOQUEO).mtimeMs;
    if (edad > BLOQUEO_CADUCA_MS) {
      console.warn(`Bloqueo huérfano (${Math.round(edad / 60000)} min): se reclama.`);
      try { unlinkSync(FICHERO_BLOQUEO); } catch { /* otra ejecución se adelantó */ }
      return tomarBloqueo(modo);
    }
    let duenyo = "";
    try { duenyo = readFileSync(FICHERO_BLOQUEO, "utf8"); } catch { /* carrera al leer */ }
    console.error(`Ya hay una sincronización en curso ${duenyo}. Se aborta para no pisarla.`);
    return false;
  }
}

function liberarBloqueo() {
  try { unlinkSync(FICHERO_BLOQUEO); } catch { /* ya liberado */ }
}

/**
 * Instancias a las que hay que avisar de que el índice cambió.
 *
 * SON VARIAS, Y ESA ES LA CORRECCIÓN (2026-08-14). El clon se sirve con DOS procesos de Node
 * —3001 y 3002, ver `infra/preproduccion/inforesidencias@.service`— y **cada uno tiene su
 * propio árbol de caché**: invalidar en uno deja al otro sirviendo lo viejo. Una sola URL no
 * podía funcionar nunca.
 *
 * Y el valor por defecto anterior era peor todavía: `127.0.0.1:3000`, un puerto donde no
 * escucha nadie desde que se montó el multi-instancia el 2026-08-08. Es decir, **la sync
 * llevaba desde entonces sin invalidar nada**, y la única señal era una línea de AVISO en un
 * log que nadie leía. Se descubrió el 2026-08-14, la primera vez que una sincronización
 * automática corrió sola de verdad.
 *
 * Se puede sobrescribir con `REVALIDAR_URL`, aceptando una lista separada por comas.
 */
const INSTANCIAS_REVALIDAR = (env.REVALIDAR_URL || "http://127.0.0.1:3001,http://127.0.0.1:3002")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

/**
 * Una lista VACÍA o mal escrita no puede pasar por éxito. Con `REVALIDAR_URL=" "` o `","` el
 * troceado deja `[]`, el bucle da cero vueltas y el recuento «avisadas === total» se cumple
 * con 0 === 0: la sync anunciaría que ha invalidado la caché sin haber llamado a nadie. Y una
 * URL sin esquema (`127.0.0.1:3001`) reventaría dentro del `fetch`, saliendo por el desagüe
 * del aviso en vez de por la puerta de la configuración. Señalado por el control a ciegas del
 * 2026-08-14 (puerta G-B7), que es justo el fallo que un implementador no se prueba a sí mismo.
 */
function validarDestinos() {
  if (INSTANCIAS_REVALIDAR.length === 0) {
    return "REVALIDAR_URL no contiene ningún destino: la caché del frontend no se invalidaría y nadie se enteraría.";
  }
  for (const u of INSTANCIAS_REVALIDAR) {
    try {
      const url = new URL(u);
      if (!/^https?:$/.test(url.protocol)) return `REVALIDAR_URL con esquema no soportado: ${u}`;
    } catch {
      return `REVALIDAR_URL con una dirección no válida (¿falta http://?): ${u}`;
    }
  }
  return null;
}

/**
 * Aviso al servidor de que el índice cambió: POST /api/interno/revalidar →
 * `revalidateTag("indice")`. Sin esto, las páginas cacheadas (Cache Components) seguirían
 * sirviendo las cifras anteriores hasta que expirase su `cacheLife` — es decir, DÍAS.
 * Si no hay configuración, AVISA y no falla: en local no hay servidor al que llamar.
 *
 * nginx no necesita purga: respeta el `s-maxage`/`stale-while-revalidate` del origen
 * (`proxy_cache_revalidate on`, ver `infra/preproduccion/clon.conf`), así que en cuanto el
 * origen regenera, el proxy se pone al día solo.
 */
/**
 * FALLAR, NO SUSURRAR (corregido el 2026-08-14 tras el control a ciegas, puertas G-B5/G-B6).
 *
 * La versión anterior escribía `console.warn` y salía con 0. Como la unidad de systemd es
 * `Type=oneshot`, eso produce una unidad VERDE con el índice sin propagar: exactamente el
 * estado que estuvo vigente del 8 al 14 de agosto sin que nadie lo notara. La señal existía y
 * no servía para nada, porque los `sync-*.log` no los mira nadie.
 *
 * Ahora un aviso fallido marca el proceso con código de salida ≠ 0, que es lo único que hace
 * aparecer la sincronización en `systemctl --failed` y en el estado del timer. El índice ya
 * está escrito en disco cuando esto ocurre —el trabajo no se pierde—, y se dice explícitamente
 * para que quien lea el fallo sepa qué falta: propagar, no re-sincronizar.
 *
 * DEUDA DECLARADA (G-B8): un código de salida solo se ve si alguien mira. La unidad no tiene
 * `OnFailure=` ni canal de aviso, así que sigue dependiendo de `systemctl --failed`. Anotado.
 */
function explicarFalloDePropagacion(motivo) {
  console.error(`ERROR: ${motivo}`);
  console.error(
    "El índice SÍ está actualizado en disco; lo que ha fallado es avisar al frontend, " +
    "así que las páginas seguirán sirviendo los datos anteriores hasta que caduque su caché."
  );
}

async function avisarRevalidacion() {
  const token = env.REVALIDAR_TOKEN;
  if (!token) {
    // En local no hay servidor al que llamar y eso es normal: aquí sí basta con avisar.
    console.warn(
      "AVISO: REVALIDAR_TOKEN no definido; no se invalida la caché del frontend. " +
      "Defínelo (y REVALIDAR_URL si las instancias no están en 3001/3002) para que la " +
      "sincronización se refleje sin redespliegue. Ver .env.example (en la raíz del proyecto)."
    );
    return;
  }
  const problema = validarDestinos();
  if (problema) {
    explicarFalloDePropagacion(problema);
    // El código de salida se pone AQUÍ, y no dentro de la ayudante, para que la escalada se
    // vea en el mismo sitio donde se decide (control a ciegas, G-B5).
    process.exitCode = 1;
    return;
  }
  let avisadas = 0;
  for (const base of INSTANCIAS_REVALIDAR) {
    try {
      const res = await fetch(`${base}/api/interno/revalidar`, {
        method: "POST",
        headers: { "x-token": token },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) avisadas++;
      else console.warn(`AVISO: ${base} respondió HTTP ${res.status} a la revalidación.`);
    } catch (e) {
      // No es motivo para marcar la sync como fallida: el índice ya está en disco.
      console.warn(`AVISO: no se pudo avisar a ${base} (${e.message}).`);
    }
  }
  if (avisadas === INSTANCIAS_REVALIDAR.length) {
    console.log(`Caché invalidada en ${avisadas}/${INSTANCIAS_REVALIDAR.length} instancias (etiqueta "indice").`);
  } else {
    // El éxito PARCIAL también es fallo: con dos instancias, avisar solo a una deja al 50 %
    // de las visitas viendo el índice anterior. Para el visitante es indistinguible de no
    // haber sincronizado (control a ciegas, G-B6).
    explicarFalloDePropagacion(
      `solo ${avisadas} de ${INSTANCIAS_REVALIDAR.length} instancias han invalidado su caché`
    );
    process.exitCode = 1;
  }
}

async function api(path, body, intento = 0) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: AUTH, "User-Agent": UA,
        ...(body !== undefined && { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) return null; // "no hay datos" en esta API
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (intento < 2) { await sleep(1500 * (intento + 1)); return api(path, body, intento + 1); }
    throw new Error(`${path}: ${e.message}`);
  }
}

const numES = s => parseFloat(String(s ?? "").replace(/\./g, "").replace(",", ".")) || null;

/**
 * El ratio de personal NO usa el mismo formato que el resto de números de este endpoint.
 *
 * MEDIDO el 2026-08-14 sobre el listado de Baix Llobregat: `precioDesde` viene a la
 * española ("2.550" = 2550) pero `ratioPersonal` viene con PUNTO DECIMAL ("7.0", "5.18",
 * "2.87"). Pasarlo por `numES` borra el punto como si fuera separador de miles: "5.18" se
 * convertía en 518 y "2.87" en 287. Con un decimal el error se compensaba solo al dividir
 * entre 10 al pintarlo, y por eso llevaba meses sin verse; con DOS decimales no: la ficha
 * 9106 salía en el listado como "28,7 profesionales por cada 10 usuarios" cuando el portal
 * original dice "2,87 empleados por cada 10 usuarios". 40 centros del índice estaban así.
 *
 * Se conserva la convención de almacenamiento (valor ×10, ver `TarjetaCentro`) a propósito:
 * cambiarla obligaría a desplegar código e índice a la vez o los listados enseñarían un
 * número disparatado entre medias.
 */
const numRatio = s => {
  const v = parseFloat(String(s ?? "").trim().replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 10 : null;
};

/**
 * "dd-mm-yyyy [hh:mm]" (formato de la API) → "yyyy-mm-dd", que ordena comparando cadenas.
 *
 * La hora es OBLIGATORIO aceptarla, y no es una hipótesis: `fechaActualizacion` llega como
 * "12-08-2026 12:00" (medido el 2026-08-14 sobre `/centro/{id}/datos-generales`). La primera
 * versión de esta función anclaba el final tras el año y devolvía null para TODOS los
 * centros: la prueba de humo de 20 dio "0 con fecha". Se descarta la hora a propósito —
 * siempre es 12:00, no es una hora real.
 */
const aIso = s => {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(s ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

function aDocumento(c, codTipologia) {
  const centroId = Number(/\/(\d+)\//.exec(c.urlInforesidencias)?.[1]) || null;
  return {
    id: `${codTipologia}-${centroId}`,
    centroId,
    codTipologia: Number(codTipologia),
    tipologia: TIPOLOGIAS[codTipologia],
    nombre: c.nombre,
    comunidad: c.comunidad,
    provincia: c.provincia,
    comarca: c.comarca,
    poblacion: c.poblacion,
    codigoPostal: c.codigoPostal,
    direccion: c.direccion,
    plazas: Number(c.plazas) || null,
    precioDesde: numES(c.precioDesde),
    ratioPersonal: numRatio(c.ratioPersonal),
    transparencia: Number(c.indiceTransparencia) || null,
    url: c.urlInforesidencias,
    imagen: c.urlImagenPrincipal || null,
  };
}

function leerJSON(fichero) {
  return existsSync(fichero) ? JSON.parse(readFileSync(fichero, "utf8")) : null;
}

/**
 * Facetas verificables (anexo RP-02, docs/research/facetas-realistas-2026-08.md).
 * Señal = "Sí" EXPLÍCITO: el "No" de la API es en gran parte valor por defecto de fichas
 * sin rellenar y no puede afirmarse como negación.
 */
const FACETAS = {
  "concertada": [["HABITACIONES", "PLAZAS-DE-FINANCIACION-PUBLICA-HOMBRE"], ["HABITACIONES", "PLAZAS-DE-FINANCIACION-PUBLICA-MUJER"]],
  "unidad-demencia": [["USUARIOS", "DISPONE-DE-UNIDAD-DE-DEMENCIA"], ["INSTALACIONES", "TIENE-UNIDAD-DE-DEMENCIA"]],
  "sin-sujeciones": [["CERTIFICADOS", "CENTRO-SIN-CONTENCIONES"]],
  "silla-ruedas": [["USUARIOS", "ADMITE-SILLA-DE-RUEDAS"]],
  "encamados": [["USUARIOS", "ADMITE-PERSONAS-ENCAMADAS"]],
  "medico-propio": [["EQUIPO-PROFESIONAL", "MEDICO"]],
  "enfermeria-propia": [["EQUIPO-PROFESIONAL", "ENFERMERA"]],
  "acreditada-dependencia": [["CERTIFICADOS", "ACREDITADO-LEY-DEPENDENCIA"]],
  "certificado-calidad": [["CERTIFICADOS", "CERTIFICADO-CALIDAD"]],
};

function extraerFacetas(caracteristicas) {
  const valor = (ambito, nombre) =>
    (caracteristicas?.[ambito]?.caracteristicas ?? []).find((c) => c.nombre === nombre)?.valor;
  const esSi = (v) => /^s[ií]$/i.test(String(v ?? "").trim());
  return Object.entries(FACETAS)
    .filter(([, pares]) => pares.some(([a, n]) => esSi(valor(a, n))))
    .map(([clave]) => clave);
}

/** Aplica la caché de facetas a los documentos (por centroId). */
function aplicarFacetas(docs) {
  const cache = leerJSON(FICHERO_FACETAS);
  if (!cache) return docs;
  for (const d of docs) {
    const e = cache.centros?.[d.centroId];
    if (!e) continue;
    if (e.facetas) d.facetas = e.facetas;
    // Coordenadas (modo `geo`): habilitan el mapa de resultados y el futuro "cerca de mí".
    if (e.geo) d.geo = e.geo;
    // Fecha de actualización (modo `actualizacion`): habilita ordenar los listados por
    // "actualizado recientemente", que el portal actual sí ofrece. El listado no la trae.
    if (e.fechaActualizacion !== undefined) d.fechaActualizacion = e.fechaActualizacion;
    // Membresía (modo `miembros`): el listado de la API NO la trae, solo la ficha completa.
    // Solo se consulta para los centros con índice de transparencia — ver el modo para el
    // porqué y sus límites.
    if (e.esMiembro !== undefined) d.esMiembro = e.esMiembro;
  }
  return docs;
}

function escribirIndice(docs, meta) {
  mkdirSync(DATA_DIR, { recursive: true });
  escribirAtomico(FICHERO_DOCS, JSON.stringify(aplicarFacetas(docs)));
  escribirAtomico(FICHERO_META, JSON.stringify(meta, null, 2));
}

/** Devuelve los pares { codTipologia, provincia, esperados } con centros > 0 (10 llamadas). */
async function descubrirRebanadas(soloProvincia) {
  const rebanadas = [];
  for (const cod of Object.keys(TIPOLOGIAS)) {
    const provincias = (await api("/poblaciones/contador-centros-provincia", { tipologia: Number(cod) })) ?? [];
    for (const p of provincias) {
      if (soloProvincia && p.provincia !== soloProvincia) continue;
      const esperados = Number(p.centros) || 0;
      if (esperados > 0) rebanadas.push({ codTipologia: cod, provincia: p.provincia, esperados });
    }
    await sleep(THROTTLE_MS);
  }
  return rebanadas;
}

/**
 * Descarga las rebanadas indicadas. Devuelve { docs, errores, discrepancias, llamadas }.
 * Dedup por id: los servicios de ámbito supraprovincial (p. ej. SAD nacionales) aparecen
 * en el listado de cada provincia a la que dan servicio; se guardan una sola vez y las
 * provincias donde aparecen se acumulan en `provinciasAlcance` (base del filtro geográfico
 * del buscador). Por eso el listado puede superar al contador (que solo cuenta radicados).
 */
async function descargarRebanadas(rebanadas) {
  const porId = new Map(), errores = [], discrepancias = [];
  let llamadas = 0, i = 0;
  for (const { codTipologia, provincia, esperados } of rebanadas) {
    i++;
    try {
      const lista = (await api("/centros/anuncios-residencias",
        { tipologia: String(codTipologia), provincia, idPoblacion: "" })) ?? [];
      llamadas++;
      for (const c of lista) {
        const doc = aDocumento(c, codTipologia);
        const previo = porId.get(doc.id);
        if (previo) previo.provinciasAlcance.push(provincia);
        else porId.set(doc.id, { ...doc, provinciasAlcance: [provincia] });
      }
      if (esperados !== undefined && lista.length < esperados)
        discrepancias.push({ provincia, codTipologia, esperados, obtenidos: lista.length });
      if (i % 25 === 0) console.log(`  ${i}/${rebanadas.length} rebanadas · ${porId.size} docs`);
    } catch (e) {
      errores.push({ provincia, codTipologia, error: e.message });
    }
    await sleep(THROTTLE_MS);
  }
  return { docs: [...porId.values()], errores, discrepancias, llamadas };
}

function resumenPorTipologia(docs) {
  const r = {};
  for (const d of docs) r[d.tipologia] = (r[d.tipologia] || 0) + 1;
  return r;
}

async function syncFull(soloProvincia) {
  const t0 = Date.now();
  console.log(`Carga ${soloProvincia ? `de prueba (${soloProvincia})` : "nacional completa"}…`);
  const rebanadas = await descubrirRebanadas(soloProvincia);
  const totalEsperado = rebanadas.reduce((s, r) => s + r.esperados, 0);
  console.log(`Rebanadas con centros: ${rebanadas.length} · centros esperados: ${totalEsperado}`);

  const { docs, errores, discrepancias, llamadas } = await descargarRebanadas(rebanadas);

  if (!soloProvincia && docs.length < MINIMO_DOCS_FULL) {
    console.error(`ABORTADO: solo ${docs.length} documentos (< ${MINIMO_DOCS_FULL}). ` +
      "No se sobrescribe el índice existente.");
    process.exit(2);
  }
  const meta = {
    generado: new Date().toISOString(),
    modo: soloProvincia ? `full:${soloProvincia}` : "full",
    totalDocs: docs.length,
    porTipologia: resumenPorTipologia(docs),
    llamadasApi: llamadas + 10,
    duracionSeg: Math.round((Date.now() - t0) / 1000),
    errores,
    discrepancias,
  };
  escribirIndice(docs, meta);
  console.log(`OK: ${docs.length} documentos en ${meta.duracionSeg}s · ` +
    `${errores.length} errores · ${discrepancias.length} discrepancias con contadores`);
  console.log(JSON.stringify(meta.porTipologia, null, 1));
  if (errores.length) { console.error("Errores:", JSON.stringify(errores)); process.exit(1); }
}

async function syncIncremental() {
  const t0 = Date.now();
  const previo = leerJSON(FICHERO_DOCS);
  const metaPrevia = leerJSON(FICHERO_META);
  if (!previo || !metaPrevia) {
    console.error("No hay índice previo: ejecuta primero `full`.");
    process.exit(2);
  }
  // Margen de 1 día sobre la última sync para cubrir husos y relojes.
  const desde = new Date(new Date(metaPrevia.generado).getTime() - 864e5);
  const fecha = `${String(desde.getDate()).padStart(2, "0")}-${String(desde.getMonth() + 1).padStart(2, "0")}-${desde.getFullYear()}`;
  console.log(`Incremental desde ${fecha} (última sync: ${metaPrevia.generado})…`);

  const ids = new Set(((await api(`/centros/ultimas-actualizaciones/${fecha}`)) ?? []).map(Number));
  console.log(`Centros actualizados: ${ids.size}`);
  if (ids.size === 0) {
    escribirIndice(previo, { ...metaPrevia, generado: new Date().toISOString(), modo: "incremental:sin-cambios" });
    console.log("Sin cambios; frescura renovada.");
    return;
  }

  /**
   * FECHAS AL DÍA SIN VOLVER A PAGAR LAS 2 HORAS (PM, 2026-08-14).
   *
   * La pasada `actualizacion` es una operación de MIGRACIÓN: se hace una vez para poblar el
   * corpus entero (~9.250 llamadas). A partir de ahí, mantener el dato al día cuesta
   * exactamente esto: una llamada por centro que HA CAMBIADO, que es la lista que este modo
   * ya tiene en la mano. Medido el 2026-08-14: 74 centros en un día, 448 en un mes. Es decir,
   * ~1 % del coste de rehacer la pasada.
   *
   * Las respuestas se guardan para que el bucle de ids desconocidos de más abajo no vuelva a
   * pedir lo mismo.
   */
  const dgPorId = new Map();
  let fechasRefrescadas = 0;
  const cacheFechas = leerJSON(FICHERO_FACETAS) ?? { centros: {} };
  for (const id of ids) {
    try {
      const dg = await api(`/centro/${id}/datos-generales`);
      await sleep(THROTTLE_MS);
      dgPorId.set(id, dg);
      const entrada = { ...(cacheFechas.centros[id] ?? {}), fechaActualizacion: aIso(dg?.fechaActualizacion) };
      // Un centro nuevo no tiene coordenadas todavía: se aprovecha la misma respuesta.
      if (entrada.geo === undefined) {
        const lat = dg?.geoLat ? parseFloat(dg.geoLat) : NaN;
        const lng = dg?.geoLong ? parseFloat(dg.geoLong) : NaN;
        entrada.geo = geoPlausible(lat, lng) ? { lat, lng } : null;
      }
      cacheFechas.centros[id] = entrada;
      fechasRefrescadas++;
    } catch (e) {
      // Una fecha que no se pudo refrescar no puede tumbar la sincronización: se queda la
      // anterior y se dice en voz alta.
      console.warn(`  centro ${id}: no se pudo refrescar la fecha (${e.message})`);
    }
  }
  cacheFechas.actualizado = new Date().toISOString();
  escribirAtomico(FICHERO_FACETAS, JSON.stringify(cacheFechas));
  console.log(`Fechas de actualización refrescadas: ${fechasRefrescadas}/${ids.size}`);

  // Provincias afectadas: por el índice actual (todo el alcance del centro)…
  const provinciasAfectadas = new Set();
  const conocidos = new Set();
  for (const d of previo) {
    if (ids.has(d.centroId)) {
      for (const p of d.provinciasAlcance ?? [d.provincia]) provinciasAfectadas.add(p);
      conocidos.add(d.centroId);
    }
  }
  // …y para ids nuevos (no en el índice), resolver provincia vía datos-generales + población.
  const desconocidos = [...ids].filter(id => !conocidos.has(id));
  for (const id of desconocidos) {
    try {
      // Ya pedida arriba al refrescar la fecha: no se vuelve a pedir.
      let dg = dgPorId.get(id);
      if (dg === undefined) {
        dg = await api(`/centro/${id}/datos-generales`);
        await sleep(THROTTLE_MS);
      }
      if (!dg?.idPoblacion) continue; // dado de baja o sin población: lo cubrirá la full nocturna
      const pob = await api(`/poblaciones/poblacion/${dg.idPoblacion}`);
      await sleep(THROTTLE_MS);
      if (pob?.provincia) provinciasAfectadas.add(pob.provincia);
    } catch (e) {
      console.warn(`  id ${id}: no se pudo resolver provincia (${e.message})`);
    }
  }
  console.log(`Provincias afectadas: ${[...provinciasAfectadas].join(", ") || "(ninguna)"} · ids nuevos: ${desconocidos.length}`);

  // Rehacer TODAS las rebanadas de las provincias afectadas (evita perder cambios de tipología).
  const rebanadas = [];
  for (const provincia of provinciasAfectadas)
    for (const cod of Object.keys(TIPOLOGIAS)) rebanadas.push({ codTipologia: cod, provincia });
  const { docs: nuevos, errores, llamadas } = await descargarRebanadas(rebanadas);

  // Merge consciente del alcance: a cada doc previo se le retiran las provincias afectadas
  // (salvo las que fallaron, que se conservan como estaban: guardarraíl) y se re-añaden las
  // que la descarga fresca confirme. Un doc sin alcance restante desaparece del índice.
  const provinciasConError = new Set(errores.map(e => e.provincia));
  const mapa = new Map();
  for (const d of previo) {
    const alcance = (d.provinciasAlcance ?? [d.provincia])
      .filter(p => !provinciasAfectadas.has(p) || provinciasConError.has(p));
    if (alcance.length) mapa.set(d.id, { ...d, provinciasAlcance: alcance });
  }
  for (const d of nuevos) {
    const conservado = mapa.get(d.id);
    const alcance = [...new Set([...(conservado?.provinciasAlcance ?? []), ...d.provinciasAlcance])];
    mapa.set(d.id, { ...d, provinciasAlcance: alcance });
  }
  const resultado = [...mapa.values()];

  const meta = {
    generado: new Date().toISOString(),
    modo: "incremental",
    totalDocs: resultado.length,
    porTipologia: resumenPorTipologia(resultado),
    centrosActualizados: ids.size,
    provinciasRehechas: [...provinciasAfectadas],
    llamadasApi: llamadas,
    duracionSeg: Math.round((Date.now() - t0) / 1000),
    errores,
  };
  escribirIndice(resultado, meta);
  console.log(`OK: ${resultado.length} documentos (antes ${previo.length}) en ${meta.duracionSeg}s · ${errores.length} errores`);
  if (errores.length) { console.error("Errores (provincias conservadas de la versión previa):", JSON.stringify(errores)); process.exit(1); }
}

/**
 * Coordenadas por centro (RESUMABLE) — `GET /centro/{id}/datos-generales` trae
 * `geoLat`/`geoLong`; el endpoint de listados NO las incluye (verificado 2026-08-05),
 * por eso hace falta una pasada por centro. Comparte la caché con las facetas y salta
 * los que ya las tienen, así que la segunda ejecución es casi instantánea.
 */
/**
 * Coordenada plausible para un centro español. La API trae basura real (verificado
 * 2026-08-05): 2 centros con valores sin punto decimal (lat 744444) y 33 situados en
 * Chile y Perú. Sin este filtro, MapLibre aborta el mapa entero con
 * "Invalid LngLat latitude value". Recuadro: península + Canarias + Ceuta y Melilla.
 */
function geoPlausible(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= 27.5 && lat <= 43.9 &&
    lng >= -18.3 && lng <= 4.4
  );
}

async function sincronizarGeo(soloProvincia, forzarTodo, limite = null) {
  const t0 = Date.now();
  const docs = leerJSON(FICHERO_DOCS);
  if (!docs) { console.error("No hay índice: ejecuta primero `full`."); process.exit(2); }
  const cache = leerJSON(FICHERO_FACETAS) ?? { centros: {} };

  const pendientes = [];
  const vistos = new Set();
  for (const d of docs) {
    if (!d.centroId || vistos.has(d.centroId)) continue;
    vistos.add(d.centroId);
    if (soloProvincia && d.provincia !== soloProvincia && !d.provinciasAlcance?.includes(soloProvincia)) continue;
    if (!forzarTodo && cache.centros[d.centroId]?.geo !== undefined) continue;
    pendientes.push(d.centroId);
  }
  if (limite && pendientes.length > limite) pendientes.length = limite;
  console.log(`Centros únicos: ${vistos.size} · pendientes de geo: ${pendientes.length}`);

  let hechos = 0, conGeo = 0, errores = 0;
  const guardar = () => {
    cache.actualizado = new Date().toISOString();
    escribirAtomico(FICHERO_FACETAS, JSON.stringify(cache));
  };
  for (const id of pendientes) {
    try {
      const dg = await api(`/centro/${id}/datos-generales`);
      const lat = dg?.geoLat ? parseFloat(dg.geoLat) : NaN;
      const lng = dg?.geoLong ? parseFloat(dg.geoLong) : NaN;
      const geo = geoPlausible(lat, lng) ? { lat, lng } : null;
      cache.centros[id] = { ...(cache.centros[id] ?? {}), geo };
      if (geo) conGeo++;
      hechos++;
    } catch (e) {
      errores++;
      console.warn(`  centro ${id}: ${e.message}`);
    }
    if (hechos % 50 === 0 && hechos > 0) {
      guardar();
      console.log(`  ${hechos}/${pendientes.length} (con coordenadas: ${conGeo})`);
    }
  }
  guardar();

  const conGeoTotal = escribirIndiceDesdeCache(docs);
  console.log(
    `Geo completado: ${hechos} centros procesados, ${conGeo} con coordenadas, ` +
    `${errores} errores, ${Math.round((Date.now() - t0) / 1000)} s. ` +
    `Documentos del índice con geo: ${conGeoTotal}.`
  );
}

/**
 * Fecha de actualización por centro (RESUMABLE) — habilita ordenar los listados por
 * "fecha de actualización" (PM, 2026-08-14).
 *
 * POR QUÉ ES UN MODO APARTE: el listado `/centros/anuncios-residencias` devuelve 14 campos
 * y NINGUNO es una fecha (verificado el 2026-08-14 contra el esquema observado
 * `DatosAnunciosResidenciasBeanAPI`). El dato solo existe en
 * `GET /centro/{id}/datos-generales`: una llamada por centro, ~9.250 en total. Comparte
 * caché y patrón con el modo `geo` —de hecho aprovecha la misma respuesta para rellenar las
 * coordenadas que falten—, así que la segunda ejecución es casi instantánea.
 *
 * MIENTRAS NO SE EJECUTE, la opción de ordenar por fecha NO se ofrece en el buscador:
 * `hayFechasActualizacion()` la esconde. Un botón que no ordena es peor que no tenerlo.
 */
async function sincronizarActualizacion(soloProvincia, forzarTodo, limite = null) {
  const t0 = Date.now();
  const docs = leerJSON(FICHERO_DOCS);
  if (!docs) { console.error("No hay índice: ejecuta primero `full`."); process.exit(2); }
  const cache = leerJSON(FICHERO_FACETAS) ?? { centros: {} };

  const pendientes = [];
  const vistos = new Set();
  for (const d of docs) {
    if (!d.centroId || vistos.has(d.centroId)) continue;
    vistos.add(d.centroId);
    if (soloProvincia && d.provincia !== soloProvincia && !d.provinciasAlcance?.includes(soloProvincia)) continue;
    if (!forzarTodo && cache.centros[d.centroId]?.fechaActualizacion !== undefined) continue;
    pendientes.push(d.centroId);
  }
  if (limite && pendientes.length > limite) pendientes.length = limite;
  console.log(`Centros únicos: ${vistos.size} · pendientes de fecha: ${pendientes.length}`);

  let hechos = 0, conFecha = 0, errores = 0;
  const guardar = () => {
    cache.actualizado = new Date().toISOString();
    escribirAtomico(FICHERO_FACETAS, JSON.stringify(cache));
  };
  for (const id of pendientes) {
    try {
      const dg = await api(`/centro/${id}/datos-generales`);
      const fecha = aIso(dg?.fechaActualizacion);
      const entrada = { ...(cache.centros[id] ?? {}), fechaActualizacion: fecha };
      // La misma respuesta trae las coordenadas: se aprovechan si aún faltaban.
      if (entrada.geo === undefined) {
        const lat = dg?.geoLat ? parseFloat(dg.geoLat) : NaN;
        const lng = dg?.geoLong ? parseFloat(dg.geoLong) : NaN;
        entrada.geo = geoPlausible(lat, lng) ? { lat, lng } : null;
      }
      cache.centros[id] = entrada;
      if (fecha) conFecha++;
      hechos++;
    } catch (e) {
      errores++;
      console.warn(`  centro ${id}: ${e.message}`);
    }
    if (hechos % 50 === 0 && hechos > 0) {
      guardar();
      console.log(`  ${hechos}/${pendientes.length} (con fecha: ${conFecha})`);
    }
  }
  guardar();

  escribirIndiceDesdeCache(docs);
  const conFechaTotal = aplicarFacetas(docs).filter((d) => d.fechaActualizacion).length;
  console.log(
    `Actualización completada: ${hechos} centros procesados, ${conFecha} con fecha, ` +
    `${errores} errores, ${Math.round((Date.now() - t0) / 1000)} s. ` +
    `Documentos del índice con fecha: ${conFechaTotal}.`
  );
}

/** Reescribe el índice aplicando la caché y devuelve cuántos docs quedaron con geo. */
function escribirIndiceDesdeCache(docs) {
  const meta = leerJSON(FICHERO_META) ?? {};
  const conCache = aplicarFacetas(docs);
  escribirAtomico(FICHERO_DOCS, JSON.stringify(conCache));
  const n = conCache.filter((d) => d.geo).length;
  meta.geo = { actualizado: new Date().toISOString(), documentosConGeo: n };
  escribirAtomico(FICHERO_META, JSON.stringify(meta, null, 2));
  return n;
}

/**
 * Membresía (RESUMABLE). Marca en el índice qué centros son clientes, para poder sugerir
 * "los miembros más transparentes de la zona" en la ficha de un centro sin información
 * (docs/26-ficha-no-miembro.md).
 *
 * POR QUÉ ES UN MODO APARTE Y NO UN CAMPO DEL `full`: el listado
 * `/centros/anuncios-residencias` NO devuelve la membresía —comprobado el 2026-08-06, sus
 * 14 campos no la incluyen— y tampoco `/centro/{id}/caracteristicas`. El único sitio donde
 * aparece es la RAÍZ de `GET /centro/{id}`, una llamada por centro.
 *
 * POR QUÉ SOLO LOS CENTROS CON ÍNDICE DE TRANSPARENCIA: hacerlo con los 9.256 costaría
 * ~2,3 h. Se midió la correlación en dos muestras de 20 (2026-08-06): **de los que tienen
 * índice de transparencia, el 100 % son miembros; de los que no lo tienen, el 5 %**. Y como
 * el criterio de sugerencia acordado es "los MÁS TRANSPARENTES", un miembro sin índice de
 * transparencia no puede entrar en ese top. Así que consultar los ~1.267 con valor cuesta
 * ~20 min y da exactamente lo que las sugerencias necesitan.
 *
 * LÍMITE QUE HAY QUE CONOCER: `esMiembro` en el índice NO responde "¿es cliente este
 * centro?" para todo el corpus —los ~400 miembros sin transparencia quedan sin marcar—.
 * Sirve para ELEGIR SUGERENCIAS. Para saber si el centro que se está viendo es cliente, la
 * ficha ya tiene el dato: `getCentro()` lo trae en cada petición. No mezclar los dos usos.
 */
async function sincronizarMiembros(soloProvincia, forzarTodo, limite = null) {
  const t0 = Date.now();
  const docs = leerJSON(FICHERO_DOCS);
  if (!docs) { console.error("No hay índice: ejecuta primero `full`."); process.exit(2); }
  const cache = leerJSON(FICHERO_FACETAS) ?? { centros: {} };

  const pendientes = [];
  const vistos = new Set();
  for (const d of docs) {
    if (!d.centroId || vistos.has(d.centroId)) continue;
    vistos.add(d.centroId);
    if (d.transparencia === null || d.transparencia === undefined) continue; // ver cabecera
    if (soloProvincia && d.provincia !== soloProvincia && !d.provinciasAlcance?.includes(soloProvincia)) continue;
    if (!forzarTodo && cache.centros[d.centroId]?.esMiembro !== undefined) continue;
    pendientes.push(d.centroId);
  }
  if (limite && pendientes.length > limite) pendientes.length = limite;
  console.log(`Centros únicos: ${vistos.size} · con transparencia y pendientes: ${pendientes.length}`);

  let hechos = 0, miembros = 0, errores = 0;
  const guardar = () => {
    cache.actualizado = new Date().toISOString();
    escribirAtomico(FICHERO_FACETAS, JSON.stringify(cache));
  };
  for (const id of pendientes) {
    try {
      const c = await api(`/centro/${id}`);
      // `miembro` vive en la RAÍZ, no en datosGenerales: buscarlo dentro devuelve undefined
      // y hace parecer que no hay ningún miembro (error cometido y corregido el 2026-08-06).
      const esMiembro = c?.miembro === true;
      cache.centros[id] = { ...(cache.centros[id] ?? {}), esMiembro };
      if (esMiembro) miembros++;
      hechos++;
    } catch (e) {
      errores++;
      console.warn(`  centro ${id}: ${e.message}`);
    }
    if (hechos % 50 === 0 && hechos > 0) {
      guardar();
      console.log(`  ${hechos}/${pendientes.length} (miembros: ${miembros})`);
    }
  }
  guardar();

  escribirIndiceDesdeCache(docs);
  const enIndice = leerJSON(FICHERO_DOCS).filter((d) => d.esMiembro).length;
  console.log(
    `Membresía completada: ${hechos} centros consultados, ${miembros} miembros, ` +
      `${errores} errores, ${Math.round((Date.now() - t0) / 1000)} s. ` +
      `Documentos del índice marcados como miembro: ${enIndice}.`
  );
}

/**
 * Enriquecimiento de facetas (RESUMABLE): un GET /centro/{id}/caracteristicas por centro
 * único pendiente; checkpoint cada 50. Pensado para la ventana nocturna (~9,2k llamadas
 * la primera vez; después solo centros nuevos o con --todo).
 */
async function enriquecer(soloProvincia, forzarTodo, limite = null) {
  const t0 = Date.now();
  const docs = leerJSON(FICHERO_DOCS);
  if (!docs) { console.error("No hay índice: ejecuta primero `full`."); process.exit(2); }
  const cache = leerJSON(FICHERO_FACETAS) ?? { centros: {} };

  const pendientes = [];
  const vistos = new Set();
  for (const d of docs) {
    if (!d.centroId || vistos.has(d.centroId)) continue;
    vistos.add(d.centroId);
    if (soloProvincia && d.provincia !== soloProvincia && !d.provinciasAlcance?.includes(soloProvincia)) continue;
    if (!forzarTodo && cache.centros[d.centroId]) continue;
    pendientes.push(d.centroId);
  }
  if (limite && pendientes.length > limite) pendientes.length = limite;
  console.log(`Centros únicos: ${vistos.size} · ya enriquecidos: ${Object.keys(cache.centros).length} · pendientes ahora: ${pendientes.length}`);

  let hechos = 0, errores = 0;
  const guardar = () => {
    cache.actualizado = new Date().toISOString();
    escribirAtomico(FICHERO_FACETAS, JSON.stringify(cache));
  };
  for (const id of pendientes) {
    try {
      const car = await api(`/centro/${id}/caracteristicas`);
      cache.centros[id] = { facetas: car ? extraerFacetas(car) : [], fecha: new Date().toISOString().slice(0, 10) };
      hechos++;
    } catch (e) {
      errores++;
      console.warn(`  centro ${id}: ${e.message}`);
    }
    if (hechos % 50 === 0 && hechos > 0) {
      guardar();
      const ritmo = hechos / ((Date.now() - t0) / 60000);
      console.log(`  ${hechos}/${pendientes.length} · ${ritmo.toFixed(0)}/min · restante ~${Math.round((pendientes.length - hechos) / ritmo)} min`);
    }
    await sleep(THROTTLE_MS);
  }
  guardar();

  // Re-aplicar al índice actual y refrescar meta de facetas.
  const conFacetas = aplicarFacetas(docs);
  const recuento = {};
  for (const d of conFacetas) for (const f of d.facetas ?? []) recuento[f] = (recuento[f] || 0) + 1;
  const meta = leerJSON(FICHERO_META) ?? {};
  meta.facetas = { actualizado: cache.actualizado, centrosEnriquecidos: Object.keys(cache.centros).length, recuentoDocs: recuento };
  escribirAtomico(FICHERO_DOCS, JSON.stringify(conFacetas));
  escribirAtomico(FICHERO_META, JSON.stringify(meta, null, 2));
  console.log(`OK: ${hechos} centros enriquecidos (${errores} errores) en ${Math.round((Date.now() - t0) / 60000)} min`);
  console.log("Recuento por faceta (docs):", JSON.stringify(recuento, null, 1));
  if (errores) process.exit(1);
}

function check() {
  const meta = leerJSON(FICHERO_META);
  if (!meta) { console.error("FRESCURA KO: no existe indice-meta.json (nunca se ha sincronizado)."); process.exit(1); }
  const horas = (Date.now() - new Date(meta.generado).getTime()) / 36e5;
  const detalle = `última sync ${meta.generado} (${horas.toFixed(1)} h) · modo ${meta.modo} · ${meta.totalDocs} docs`;
  if (horas > MAX_HORAS_FRESCURA) { console.error(`FRESCURA KO: ${detalle}`); process.exit(1); }
  if (meta.errores?.length) { console.error(`FRESCURA AVISO (errores en última sync): ${detalle}`); process.exit(1); }
  console.log(`FRESCURA OK: ${detalle}`);
}

/**
 * Parseo de argumentos ESTRICTO (lección 2026-08-05): se invocó el modo `geo` con
 * `--provincia` en vez de `--solo-provincia`, el flag se ignoró EN SILENCIO y lo que
 * iba a ser una prueba de humo acabó recorriendo los 9.220 centros durante 89 minutos
 * contra la API de producción. Un job de sincronización nunca debe hacer MÁS trabajo
 * del pedido por culpa de una errata: ante un argumento desconocido, aborta.
 */
const MODOS = ["full", "incremental", "check", "enriquecer", "geo", "miembros", "actualizacion"];
const BANDERAS_VALOR = ["--solo-provincia", "--provincia", "--limite"];
const BANDERAS_SUELTAS = ["--todo"];

function parsearArgumentos(argv) {
  const modo = argv[2] || "full";
  if (!MODOS.includes(modo)) {
    console.error(`Modo desconocido: "${modo}". Válidos: ${MODOS.join(", ")}.`);
    process.exit(2);
  }
  const opciones = { soloProvincia: null, limite: null, todo: false };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (BANDERAS_SUELTAS.includes(a)) {
      opciones.todo = true;
    } else if (BANDERAS_VALOR.includes(a)) {
      const valor = argv[++i];
      if (!valor || valor.startsWith("--")) {
        console.error(`La opción ${a} necesita un valor.`);
        process.exit(2);
      }
      // --provincia es alias de --solo-provincia: el error de 2026-08-05 fue teclear
      // la forma "obvia"; se acepta en vez de castigarla.
      if (a === "--limite") {
        const n = Number(valor);
        if (!Number.isInteger(n) || n <= 0) {
          console.error(`--limite debe ser un entero positivo (recibido: ${valor}).`);
          process.exit(2);
        }
        opciones.limite = n;
      } else {
        opciones.soloProvincia = valor;
      }
    } else {
      console.error(
        `Argumento desconocido: "${a}".\n` +
        `Opciones válidas: ${[...BANDERAS_VALOR, ...BANDERAS_SUELTAS].join(", ")}.\n` +
        `Se aborta para no ejecutar más trabajo del pedido.`
      );
      process.exit(2);
    }
  }
  return { modo, ...opciones };
}

const { modo, soloProvincia, limite, todo } = parsearArgumentos(process.argv);
// Ctrl-C o `systemctl stop` no deben dejar el cerrojo puesto.
for (const senyal of ["SIGINT", "SIGTERM"]) {
  process.on(senyal, () => { liberarBloqueo(); process.exit(130); });
}
process.on("exit", () => liberarBloqueo());
if (soloProvincia) console.log(`Ámbito limitado a la provincia: ${soloProvincia}`);
if (limite) console.log(`Límite de centros a procesar: ${limite}`);

// `check` solo lee: no toma el cerrojo (si no, un check durante la nocturna daría KO falso).
if (modo === "check") {
  check();
} else {
  if (!tomarBloqueo(modo)) process.exit(3);
  try {
    if (modo === "full") await syncFull(soloProvincia);
    else if (modo === "incremental") await syncIncremental();
    else if (modo === "enriquecer") await enriquecer(soloProvincia, todo, limite);
    else if (modo === "geo") await sincronizarGeo(soloProvincia, todo, limite);
    else if (modo === "miembros") await sincronizarMiembros(soloProvincia, todo, limite);
    else if (modo === "actualizacion") await sincronizarActualizacion(soloProvincia, todo, limite);
    else {
      console.error(`Modo desconocido: ${modo} (usa full | incremental | check | enriquecer | geo | miembros)`);
      process.exit(2);
    }
    // Solo si llegamos aquí el índice quedó bien escrito: se avisa al frontend.
    await avisarRevalidacion();
  } finally {
    // `finally` también corre si un `process.exit(1)` viene de dentro de las funciones,
    // pero NO en un exit directo: por eso además se libera en el manejador de señales.
    liberarBloqueo();
  }
}

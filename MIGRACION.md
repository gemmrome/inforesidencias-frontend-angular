# Migración a Angular — estado

Este proyecto es una reescritura completa del frontend de inforesidencias.com,
originalmente en Next.js 16 / React 19, a Angular 22. Es una migración de framework, no
una actualización de versión: no comparte código ejecutable con el original, aunque
porta literalmente toda su lógica de negocio.

**No se ha podido ejecutar `npm install` ni compilar este proyecto** (el registro de
npm estaba bloqueado en el entorno donde se escribió). Todo el código se ha escrito a
mano siguiendo la sintaxis de Angular 22. Sí se ha pasado el compilador de TypeScript
en modo "solo sintaxis" (sin type-checking completo, porque faltan las dependencias)
sobre los ficheros del proyecto, lo que encontró y corrigió un error real (una
comilla invertida suelta dentro de un comentario HTML que rompía el *template literal*
de `SiteFooterComponent`). Eso da cierta confianza en que no hay errores de sintaxis
burdos, pero NO sustituye a un `ng build` real — pueden aparecer errores de tipos o de
API que solo se ven compilando con las dependencias instaladas. Por eso el flujo de
trabajo desde esta entrega es: tú ejecutas `npm install` / `ng serve` en tu máquina (que
sí tiene acceso al registro de npm) y me pasas los errores reales que salgan; yo los
diagnostico contra el código fuente y los corrijo aquí. Así se han corregido ya varios
errores reales (ver "Errores corregidos a partir de tus pruebas" más abajo). Este
documento se irá actualizando en cada entrega.

## Cómo arrancarlo

```bash
npm install
ng serve      # desarrollo: recarga en caliente de TS/HTML/CSS, Tailwind incluido
```

`npm run dev` (que ejecuta `src/server.ts` directamente con `tsx watch`, sin pasar por
`ng build`) NO sirve para desarrollo normal: ese fichero da por hecho que corre ya
compilado dentro de `dist/<proyecto>/server/`, junto a `dist/<proyecto>/browser/` (así
calcula `browserDistFolder`). Ejecutado con `tsx` directamente sobre el `.ts` de
`src/`, esa cuenta de rutas apunta a una carpeta `browser/` que no existe, así que
`express.static(...)` no encuentra el CSS compilado (ni el resto de estáticos) — la
página puede seguir viéndose SSR-renderizada con datos reales, pero sin ningún estilo,
que es exactamente el síntoma de "veo el contenido pero sin diseño". Ese script solo es
útil para probar el servidor Express de producción en local, y hay que hacer `ng build`
antes de lanzarlo. Para desarrollar, usa siempre `ng serve`.

Sin datos en `data/` el buscador no tendrá centros que listar: ese directorio es una
caché generada por `npm run sync:full` (script portado sin cambios desde el original,
`scripts/sync-indice.mjs`) contra el backend real, y no se versiona.

## Qué está completo

- **Capa de dominio/lib** (`src/app/shared/`, `src/server/`): las ~4.377 líneas de
  lógica de negocio del original (`src/lib/`) están portadas literalmente, incluyendo
  el adaptador `adapter/centro.ts` (el fichero más crítico: reglas de negocio con fecha
  y justificación de PM), el índice de búsqueda MiniSearch, la geografía, las
  estadísticas por zona, el parser de búsqueda, etc.
- **Servidor Express + SSR** (`src/server.ts` y `src/server/routes/`): sustituye a las
  Route Handlers de Next. Incluye `/api/v1/*` (centros/buscar, centros/interpretar,
  centros/mapa, geografia, **listado**, **home**), `/api/puente/*`,
  `/api/interno/revalidar`, `/robots.txt` y `/sitemap.xml` + `/sitemaps/:familia`.
- **Cabecera y pie** (`SiteHeaderComponent`, `MenuMovilComponent`, `SiteFooterComponent`,
  `CargadorChatComponent`, `BloqueAsesoramientoComponent`, `PlaceholderBlockComponent`,
  `EnlaceProactivaComponent`).
- **Home completa** (`HomePageComponent`): hero con buscador, banda de cifras reales,
  tipologías, escaparate de transparencia, familias de listados, distribuidor
  geográfico y bloque de asesoramiento — portada de `src/app/(sitio)/page.tsx`.
- **Buscador / listado geográfico completo** (`ListadoPageComponent` en
  `/centros/buscador/:tipologia[/geo...]`, hasta 3 niveles de zona): búsqueda libre con
  autocompletado (zonas + centros, navegación por teclado), panel de filtros por
  faceta con contadores, filtro de presupuesto con histograma, mapa de resultados con
  Leaflet (carga bajo demanda), tarjetas de centro, paginación truncada, ordenación,
  resumen editorial de la zona y FAQs — portado de la página de servidor más grande del
  original (694 líneas). Ver "Diferencia arquitectónica" más abajo.
- **Estilos**: Tailwind CSS 4 con los tokens de diseño originales (contrastes WCAG AA
  documentados) portados literalmente a `src/styles.css`.
- **Árbol de rutas**: home, listado del buscador (con las 4 profundidades de zona), la
  ficha de centro y la landing de búsqueda proactiva `/particulares/buscamos-por-ti`
  (a pantalla completa, sin cabecera/pie, como en el original).
- **Ficha de centro completa** (`FichaCentroPageComponent` en
  `/centros/:tipo/:id/:slug`): cabecera con logo/plazas/transparencia/grupo, acciones
  de contacto medibles ("Ver teléfono"/"Ver web"), galería con pestañas SIN JavaScript
  (radios + CSS: "El centro" / "La comida" / "Vídeos", cada una solo si tiene
  contenido), mapa de ubicación con vista previa en SVG y embed de OpenStreetMap
  click-to-load, tabla de precios por habitación, descripción/"por qué elegirnos",
  todos los grupos de características, documentación (PDF + descripción),
  formulario "Pedir información" completo (con reCAPTCHA v2 bajo demanda) y JSON-LD
  (NursingHome/LocalBusiness + BreadcrumbList). Portado de
  src/app/(sitio)/centros/[tipo]/[id]/[slug]/page.tsx (852 líneas) y sus componentes de
  `src/components/ficha/` y `FormularioContactoCentro`.
  - **Centro sin información** (`FichaSinInformacionComponent`, docs/26): en vez de
    huecos o de competidores sin explicar por qué, dice la verdad ("aún no ha
    facilitado sus datos"), ofrece hasta 4 centros de la zona que sí publican y un
    enlace para que el responsable del centro lo reclame. Reutiliza
    `MapaResultadosComponent`, al que se le ha añadido el modo `puntos` (array directo,
    sin petición) que su propio comentario ya dejaba anotado como pendiente.
  - **404/308 REALES** (`fichaCentroPaginas` en `src/server/routes/ficha-centro.ts`,
    montado en `server.ts` antes del estático y del catch-all de Angular): la URL corta
    `/centros/:tipo/:id` siempre redirige (308) a la canónica o da 404 — nunca renderiza
    nada, igual que el original; en `/centros/:tipo/:id/:slug`, un slug no canónico
    redirige y un centro inexistente da 404, antes de que Angular SSR llegue a pintar
    nada. La comprobación de canonicidad usa el índice local, exactamente como el
    original (`resolucionFicha`): mismo riesgo aceptado y anotado (una ficha que la API
    sirva pero que aún no esté en el índice da 404 hasta la siguiente sync).
  - `GET /api/v1/ficha-centro` hace el mismo cálculo que `Ficha()`/`centroDeParams()`
    del original; `FichaCentroPageComponent` solo pide y pinta.

## Diferencia arquitectónica importante: Server Components → endpoints JSON

El original calculaba y renderizaba en el mismo paso, dentro de Server Components de
Next que podían importar `src/lib/` directamente. Angular no tiene Server Components:
sus componentes son isomorfos (corren igual en servidor y en navegador) y no pueden
importar nada de `src/server/` — esa frontera la marca `server-only.ts`, igual que
antes marcaba `import "server-only"`.

Por eso, para cada página que antes calculaba sus datos en el servidor, aquí hay un
endpoint JSON en `src/server/routes/` que hace EXACTAMENTE el mismo cálculo (reutiliza
literalmente las mismas funciones ya portadas de `indice/`, `estadisticas/` y
`buscador/filtros`), y el componente Angular de la página solo pide ese JSON con
`HttpClient` (que funciona igual en SSR y en cliente, así que el SEO no se resiente) y
lo pinta. Ya existen `GET /api/v1/home` y `GET /api/v1/listado`; cada página nueva que
se porte necesitará el suyo con el mismo patrón.

## Convención de ficheros de componente

Cada componente tiene su plantilla en un `.html` aparte (`templateUrl`), no inline —
igual que el `.component.html` que genera `ng generate component` por defecto. Ningún
componente usa estilos propios (`styles`/`styleUrl`): todo el diseño es Tailwind por
clases de utilidad en el HTML, así que no hace falta un `.css` por componente.

## Errores corregidos a partir de tus pruebas

Estos son errores reales que solo aparecen ejecutando `npm install` / `ng serve` con las
dependencias instaladas — exactamente lo que este entorno no puede hacer — y que me has
reportado tú probando en tu máquina:

- **`TIPOLOGIAS_RUTA` no exportado** en `src/server/indice/sitemap.ts`: lo importaba de
  `./geo`, que no lo reexporta. Corregido para importarlo de
  `../../app/shared/indice/tipos`, que es donde vive.
- **`TS5090`** (falta `baseUrl` en `tsconfig.json` para poder usar `paths`): añadido
  `"baseUrl": "."`.
- **`NG0401: Missing Platform`** al arrancar `ng serve` (durante el `bundling
  dependencies` de Vite en modo SSR). Dos causas, las dos en el arranque del servidor:
  1. `src/app/app.config.server.ts` importaba `provideServerRendering` de
     `@angular/platform-server`, que era la ruta correcta en versiones antiguas de
     Angular pero en Angular 20+ deja la cadena de providers de la plataforma de
     servidor incompleta sin avisar en tiempo de compilación. Corregido para importarlo
     de `@angular/ssr`.
  2. `src/main.server.ts` no aceptaba ni reenviaba el parámetro `context:
     BootstrapContext` que el motor de SSR (el middleware Vite de `ng serve`, o
     `AngularNodeAppEngine` en producción) necesita pasarle a `bootstrapApplication`.
     Corregido: `const bootstrap = (context: BootstrapContext) =>
     bootstrapApplication(AppComponent, config, context);`.
- **Página sin estilos en rutas anidadas** (p. ej. `/centros/buscador/...`): faltaba
  `<base href="/">` en `src/index.html`. Sin ella, en cualquier URL que no sea la raíz
  el navegador resuelve los assets (CSS/JS del build) como rutas relativas a esa URL en
  vez de a la raíz del sitio, así que Express devolvía el `index.html` de repuesto en
  lugar del CSS/JS reales (`Content-Type: text/html` donde tocaba `text/css`).
- **Aviso de deprecación de `baseUrl`** en `tsconfig.json`: TypeScript 6 lo marca
  deprecado. Añadido `"ignoreDeprecations": "6.0"` para silenciarlo sin quitar
  `baseUrl` (lo siguen usando los alias `@/*`, `@shared/*`, `@server/*`).
- **`.env.local` no se cargaba nunca** ("Falta API_KEY_API_IR en el entorno" al abrir
  una ficha de centro, pese a tenerlo escrito en `.env.local`): nada en el proyecto
  leía ese fichero salvo `scripts/sync-indice.mjs`, que trae su propio lector suelto.
  `src/server.ts` (y por tanto `ng serve`/`node server.mjs`) nunca lo había leído — con
  `/api/v1/listado` y `/api/v1/home` no se notaba porque leen del índice local, no de la
  API en caliente. La ficha de centro sí llama a `getCentro()` en caliente, y ahí
  reventaba. Corregido con `src/server/cargar-env.ts` (nuevo, primer import de
  `server.ts`): `process.loadEnvFile('.env.local')`, nativo desde Node 20.6, sin añadir
  la dependencia `dotenv`. No sobrescribe una variable que el entorno YA tenga puesta,
  así que es seguro también en producción. **Comprueba que `.env.local` esté en la raíz
  del proyecto** (junto a `package.json`), que es de donde lo lee.
- **Fallo de `getCentro` sin capturar en la ficha de centro** (`unhandledRejection` /
  "Application did not stabilize"): los handlers `async` de
  `src/server/routes/ficha-centro.ts` no envolvían la llamada a la API en un
  `try/catch` — Express 4 no convierte solo por ser `async` una promesa rechazada en un
  `next(err)`, así que un fallo (API caída, credencial mal puesta) dejaba la petición
  colgada hasta que el SSR de Angular agotaba su tiempo de estabilización. Ahora
  responden 502 al instante, que `FichaCentroPageComponent` trata igual que cualquier
  otro fallo de red.
- **`ng build` fallaba con "route uses prerendering and includes parameters, but
  'getPrerenderParams' is missing"** en las 5 rutas con parámetros (el listado y la
  ficha de centro): desde Angular 19+, sin un fichero de configuración de rutas de
  servidor, el build intenta PRE-renderizar en tiempo de compilación cualquier ruta con
  parámetros, y pide una función que enumere de antemano todos los valores posibles de
  esos parámetros — algo que no tiene sentido aquí, porque ni el listado ni la ficha de
  centro son contenido estático: dependen del índice sincronizado o de una llamada en
  vivo a la API. Corregido con `src/app/app.routes.server.ts` (nuevo), que marca todas
  las rutas con `RenderMode.Server` (renderizar en cada petición, no en build) mediante
  un único `'**'`, conectado en `app.config.server.ts` vía
  `provideServerRendering(withRoutes(serverRoutes))`. **Nota**: la primera versión de
  este fix usaba `provideServerRouting(...)`, una función que no existe en la API real
  de `@angular/ssr` de este proyecto (Angular 22) — el nombre correcto es `withRoutes`,
  una *feature* que se pasa como argumento a `provideServerRendering(...)`, no una
  función `provide*` aparte. Gracias a comprobar los `.d.ts` instalados en tu máquina se
  confirmó el nombre real en vez de asumirlo.

## Qué falta (por orden de trabajo previsto)

1. ~~Ficha de centro~~ — completa (ver arriba).
2. **Formularios de leads**: el de contacto con centro (`FormularioContactoCentroComponent`)
   ya está — falta la búsqueda proactiva completa con las preguntas de perfil (hoy
   `/particulares/buscamos-por-ti` sigue siendo un placeholder).
3. **Resto del árbol de rutas**: `/buscar` (resultado de la búsqueda del hero),
   `/precios-residencias[/:provincia]`, `/residencias-mas-transparentes[/:provincia]`,
   `/centros/directorio`, las familias de listados por faceta
   (`/residencias-concertadas`, etc.). Varios enlaces del buscador y de la home ya
   apuntan a estas rutas (con `routerLink`) aunque todavía no existan.
4. **Anuncios** (`SlotPatrocinio`, `ResultadoPatrocinado`): deliberadamente fuera del
   alcance acordado de esta migración de `lib/`; no están portados.
5. **Metadatos SEO completos por página** (canonical, OpenGraph, JSON-LD). Hoy
   `ListadoPageComponent` solo fija el `<title>` con el servicio `Title` de Angular —
   lo mínimo para no navegar con todas las páginas llamándose igual.
6. **Pruebas** (el original usa Vitest; el proyecto ya tiene el test runner de Angular
   configurado con Vitest, pero no hay pruebas portadas todavía).
7. **Verificación de build** — pendiente de que se ejecute `npm install` / `ng build`
   en una máquina con acceso a los registros de npm. Es el paso más importante que
   falta: todo lo anterior está escrito pero no compilado.

## Iré actualizando este mismo zip

Cada entrega sucesiva sustituirá a esta, con este documento reflejando el estado real
en ese momento.

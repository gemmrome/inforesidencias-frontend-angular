/**
 * Contrato de los formularios de lead — inventario EXHAUSTIVO extraído del HTML y JS
 * reales de producción (2026-08-04). Portado LITERAL de src/lib/leads/contrato.ts.
 * Nombres de campo = los que espera el monolito (puente temporal, docs/12); cuando
 * exista POST /v1/leads (docs/11) solo cambia el adaptador del puente
 * (`src/server/leads/puente.ts`), no estos formularios.
 *
 * Constantes puras: en el original las consumían componentes cliente y route handlers
 * de servidor por igual; aquí, componentes Angular (formularios reactivos) y los
 * manejadores Express de `/api/puente/*`.
 */

export const TIPOLOGIAS_FORMULARIO = [
  { valor: '1', etiqueta: 'Residencias' },
  { valor: '2', etiqueta: 'Centros de día para mayores' },
  { valor: '8', etiqueta: 'Servicio de atención domiciliaria' },
  { valor: '10', etiqueta: 'Teleasistencia' },
  { valor: '13', etiqueta: 'Apartamentos con servicios' },
  { valor: '90', etiqueta: 'Salud mental' },
] as const;

export const PRECIOS_MAXIMOS = [
  { valor: '1000', etiqueta: '1.000€' },
  { valor: '1250', etiqueta: '1.250€' },
  { valor: '1500', etiqueta: '1.500€' },
  { valor: '1750', etiqueta: '1.750€' },
  { valor: '2000', etiqueta: '2.000€' },
  { valor: '2250', etiqueta: '2.250€' },
  { valor: '2500', etiqueta: '2.500€' },
  { valor: '2750', etiqueta: '2.750€' },
  { valor: '3000', etiqueta: '3.000€' },
  { valor: '3250', etiqueta: '3.250€' },
  { valor: '3500', etiqueta: '3.500€' },
  { valor: '3750', etiqueta: '3.750€' },
  { valor: '4000', etiqueta: '4.000€' },
  { valor: '*', etiqueta: 'Sin precio máximo' },
] as const;

export const GENEROS = [
  { valor: 'M', etiqueta: 'Mujer' }, // por defecto en producción
  { valor: 'H', etiqueta: 'Hombre' },
  { valor: 'P', etiqueta: 'Pareja' },
] as const;

export const CUANDO = [
  'Ingreso urgente',
  'Para los próximos meses',
  'Estoy planificando para el futuro',
] as const;

export const HORARIOS_CONTACTO = ['Indiferente', 'Mañana', 'Mediodia', 'Tarde', 'Noche'] as const;

export const COMO_NOS_HAS_CONOCIDO = [
  'Navegando por internet',
  'A través de Servicios Sociales',
  'Ya lo conocía',
  'Otros',
] as const;

/** Las 51 provincias del select de producción, en su orden y con sus nombres exactos. */
export const PROVINCIAS_FORMULARIO = [
  'A Coruña', 'Álava - Araba', 'Albacete', 'Alicante - Alacant', 'Almería', 'Asturias',
  'Ávila', 'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
  'Castellón - Castelló', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada',
  'Guadalajara', 'Guipúzcoa - Gipuzkoa', 'Huelva', 'Huesca', 'Islas Baleares - Illes Balears',
  'Jaén', 'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla',
  'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia - València', 'Valladolid', 'Vizcaya - Bizkaia', 'Zamora', 'Zaragoza',
] as const;

/** Textos legales literales de producción (mismo consentimiento durante el puente). */
export const TEXTO_CONDICIONES_LEGALES =
  'Entiendo que este formulario de petición de más información lo recibirán en la dirección ' +
  'de correo electrónico facilitado por la residencia destinataria y en una dirección de ' +
  'inforesidencias.com con la finalidad de control de calidad y supresión de spam. Los datos ' +
  'facilitados no serán tratados, cedidos ni utilizados para otra finalidad. Queda a su ' +
  'discreción los datos que facilita, nuestra recomendación es que sean los mínimos posibles ' +
  'para obtener la información que necesita. Puede ver nuestra política completa de ' +
  'protección de datos en el aviso legal.';

export const TEXTO_PENSIUM = 'Deseo recibir información para financiar el pago de la residencia';

/**
 * Opt-in ÚNICO de comunicaciones de inforesidencias.com (corrección PM 2026-08-05).
 * Regla: **una sola casilla de opt-in por formulario**, mapeada al campo que el backend
 * procesa de verdad — contacto → `contacto.recibirMasInformacion`; proactivo →
 * `suscribirNewsletter`. Ver la cabecera completa en el fichero original para el porqué
 * y las pendientes con el administrador del backend.
 */
export const TEXTO_NEWSLETTER =
  'Quiero recibir el boletín de inforesidencias.com con novedades del sector y consejos ' +
  'para elegir centro';

export const TEXTO_PENSIUM_LEGAL =
  'Acepto que me llamen por teléfono o contacten conmigo por correo electrónico desde la ' +
  'empresa Pensium, S.L. para informarme sobre su producto de financiación de estancias en ' +
  'residencias de personas mayores. Pensium, S.L. domiciliada en la Calle Balmes, 83 ' +
  'Principal primera de Barcelona (08008), con CIF B66834904 se compromete a utilizar sus ' +
  'datos (nombre, teléfono y correo electrónico) únicamente con el fin de comunicarle la oferta.';

/**
 * Sitekey reCAPTCHA v2 de producción (pública). Sobre-escribible por entorno en preprod.
 * En Next era `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (inyectada en build). En Angular, las
 * variables `NG_PUBLIC_*` no existen: este valor debe inyectarse en tiempo de RUNTIME
 * (no de build) a través de `RECAPTCHA_SITE_KEY` en `src/app/core/entorno-cliente.token.ts`,
 * que el servidor Express rellena en el HTML (ver ese fichero) — igual de público que
 * antes (es una sitekey, no un secreto), pero configurable sin recompilar.
 */
export const RECAPTCHA_SITE_KEY_POR_DEFECTO = '6Lf4-3AUAAAAAAUjYXJ3O4nn6dRDJgKBS4JpHdt8';

/** Campos del formulario de contacto con centro (POST /centros/contactar/{id}). */
export interface CamposContactoCentro {
  'contacto.nombre': string;
  'contacto.email': string;
  'contacto.telefono': string;
  'contacto.provincia': string;
  'contacto.mensaje': string;
  condicionesLegales: '1';
  /** Opt-in de comunicaciones: ÚNICA casilla del formulario (ver TEXTO_NEWSLETTER). */
  'contacto.recibirMasInformacion'?: '1';
  'contacto.realizarContactoPensium'?: '1';
  'g-recaptcha-response'?: string;
}

/** Campos del formulario proactivo (POST /centros/buscador/proactivo/enviar-datos). */
export interface CamposProactivo {
  busquedaProactiva: 'true';
  'buscadorProactivo.tipologia': string;
  'buscadorProactivo.localizacion': string;
  'buscadorProactivo.provincia': string;
  'buscadorProactivo.comarca': string;
  'buscadorProactivo.idPoblacion': string;
  'buscadorProactivo.precioMaximo': string;
  'buscadorProactivo.plazasFinanciadas'?: '1';
  realizarContactoPensium?: '1';
  'buscadorProactivo.genero': 'M' | 'H' | 'P';
  'buscadorProactivo.personaEdad': string;
  'buscadorProactivo.personaCuando': string;
  'buscadorProactivo.personaNecesidades': string;
  'buscadorProactivo.contactoPersona': string;
  'buscadorProactivo.contactoTelefono': string;
  'buscadorProactivo.contactoEmail': string;
  'buscadorProactivo.contactoHorario': string;
  'buscadorProactivo.contactoComoNosHasConocido': string;
  suscribirNewsletter?: '1';
  /** Honeypots de producción: deben viajar VACÍOS (anti-spam). */
  'nombre-control': string;
  'email-control': string;
  'g-recaptcha-response'?: string;
}

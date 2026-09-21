/**
 * Etiquetas legibles para las claves de características de la API. Portado LITERAL de
 * src/lib/adapter/etiquetas.ts. No lleva `server-only` en el original ni aquí: son
 * datos puros, pero viven junto al resto del adaptador por cohesión (solo los usa
 * `adapter/centro.ts`, que sí es server-only).
 *
 * Ver la cabecera del fichero original para el porqué exhaustivo: "Medico" y "Eleccion
 * menu" salían así en 9.220 fichas antes de esta tabla, en un sitio cuyo argumento
 * comercial es el rigor.
 */
export const ETIQUETAS_CARACTERISTICAS: Record<string, string> = {
  // — CERTIFICADOS —
  'ACREDITADO-LEY-DEPENDENCIA': 'Acreditado por la ley de dependencia',
  'CENTRO-SIN-CONTENCIONES': 'Centro sin contenciones',
  'CENTRO-SIN-CONTENCIONES-TEXTO': 'Centro sin contenciones (detalle)',
  'CERTIFICADO-CALIDAD': 'Certificado de calidad',
  'CERTIFICADO-CALIDAD-TEXTO': 'Certificado de calidad (detalle)',
  'COMITE-ETICA': 'Comité de ética',
  'COMITE-ETICA-TEXTO': 'Comité de ética (detalle)',
  'OTRAS-CERTIFICACIONES': 'Otras certificaciones',
  'OTRAS-CERTIFICACIONES-TEXTO': 'Otras certificaciones (detalle)',

  // — SERVICIOS —
  ACOMPAÑAMIENTO: 'Acompañamiento',
  'ELECCION-MENU': 'Elección de menú',
  'INFORMES-DE-SALUD': 'Informes de salud',
  PELUQUERIA: 'Peluquería',
  PODOLOGIA: 'Podología',
  'PRODUCTOS-HIGIENE': 'Productos de higiene',
  REHABILITACION: 'Rehabilitación',

  // — USUARIOS (a quién admite el centro) —
  'ADMITE-PERSONAS-ENCAMADAS': 'Admite personas encamadas',
  'ADMITE-SILLA-DE-RUEDAS': 'Admite personas en silla de ruedas',
  'DISPONE-DE-UNIDAD-DE-DEMENCIA': 'Dispone de unidad de demencia',

  // — EQUIPO PROFESIONAL —
  'ANIMADOR-SOCIOCULTURAL': 'Animador/a sociocultural',
  'EDUCADOR-SOCIAL': 'Educador/a social',
  ENFERMERA: 'Enfermero/a',
  FARMACEUTICO: 'Farmacéutico/a',
  FISIOTERAPEUTA: 'Fisioterapeuta',
  LOGOPEDA: 'Logopeda',
  MEDICO: 'Médico/a',
  OTROS: 'Otros profesionales',
  PSICOLOGO: 'Psicólogo/a',
  'RATIO-DE-PERSONAL': 'Ratio de personal',
  TERAPEUTA: 'Terapeuta',
  'TITULACION-DIRECTOR': 'Titulación del director/a',
  'TRABAJADOR-SOCIAL': 'Trabajador/a social',

  // — INSTALACIONES —
  COCINA: 'Cocina',
  PARKING: 'Aparcamiento',
  PISCINAS: 'Piscinas',
  'PLAZAS-TOTALES': 'Plazas totales',
  SUPERFICIE: 'Superficie',
  'TIENE-UNIDAD-DE-DEMENCIA': 'Unidad de demencia',
  'TIPO-EDIFICIO': 'Tipo de edificio',
  'TRANSPORTE-PUBLICO': 'Transporte público',
  'ZONA-VERDE': 'Zona verde',

  // — HABITACIONES (lo que no son códigos de precio/estado) —
  'PLAZAS-DE-FINANCIACION-PUBLICA-HOMBRE': 'Hombres',
  'PLAZAS-DE-FINANCIACION-PUBLICA-MUJER': 'Mujeres',
  'SISTEMA-DE-PRECIOS': 'Sistema de precios',

  // — DOCUMENTACIÓN —
  'DESCRIPCION-HORARIO': 'Horario',
  'DESCRIPCION-INSPECCION-SANIDAD': 'Inspección de sanidad',
  'DESCRIPCION-INSPECCION-SERV-SOC': 'Inspección de servicios sociales',
  'DESCRIPCION-MODELO-CONTRATO': 'Modelo de contrato',
  'DESCRIPCION-PERSONAL': 'Personal',
  'DESCRIPCION-REGLAMENTO': 'Reglamento',
};

/** Título de sección por ámbito, cuando el que manda la API confunde (HABITACIONES vs.
 *  el bloque de precios). Ver cabecera del original para el detalle. */
export const ETIQUETAS_AMBITOS: Record<string, string> = {
  HABITACIONES: 'Plazas de financiación pública',
};

/** Claves que NO son información para el usuario, sino directivas de configuración del
 *  propio portal. Se ocultan en vez de traducirse. */
export const CLAVES_OCULTAS = new Set(['MOSTRAR-PRECIOS-EN-FICHA']);

/** Etiqueta legible de una clave, con respaldo para las que no estén en la tabla. */
export function etiquetaDesdeNombre(nombre: string): string {
  const conocida = ETIQUETAS_CARACTERISTICAS[nombre];
  if (conocida) return conocida;
  const texto = nombre.toLowerCase().replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Evita la redundancia "etiqueta + valor que repite la etiqueta" ("Grupo: **Grupo**
 * DomusVi"). Compara sin tildes ni mayúsculas; solo recorta al PRINCIPIO.
 */
export function valorSinRepetirEtiqueta(etiqueta: string, valor: string): string {
  const normalizar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  const e = normalizar(etiqueta);
  const v = normalizar(valor);
  if (!e || !v.startsWith(e)) return valor;

  const resto = valor.slice(etiqueta.length).replace(/^[\s:;,.-]+/, '');
  return resto.length > 0 ? resto : valor;
}

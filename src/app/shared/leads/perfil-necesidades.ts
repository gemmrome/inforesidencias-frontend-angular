/**
 * Perfil de necesidades por preguntas — sustituye al textarea libre obligatorio
 * `buscadorProactivo.personaNecesidades` del formulario de producción. Portado LITERAL
 * de src/lib/leads/perfil-necesidades.ts (módulo puro, sin React ni fetch — no cambia
 * nada al pasar a Angular).
 *
 * POR QUÉ (evidencia 2026-08-06, docs/27 y docs/28): el campo libre es obligatorio y es
 * el más caro de rellenar en un móvil (75,5 % del tráfico de la landing). Seis preguntas
 * de botones cubren lo que el texto libre recoge hoy, y lo recogen ESTRUCTURADO
 * (filtrable para el matching) en vez de en prosa. El texto libre se mantiene, pero
 * OPCIONAL y al final.
 */

export interface OpcionPerfil {
  valor: string;
  etiqueta: string;
  /** Fragmento en prosa que esta opción aporta a la descripción final ("La persona…"). */
  frase: string;
}

export interface PreguntaPerfil {
  id: string;
  pregunta: string;
  ayuda?: string;
  /** Si es true, se pueden marcar varias opciones. */
  multiple?: boolean;
  opciones: readonly OpcionPerfil[];
}

/** Las seis preguntas, en orden de frecuencia con que el concepto aparece en las
 *  descripciones reales. La primera es la que más discrimina para el matching. */
export const PREGUNTAS_PERFIL: readonly PreguntaPerfil[] = [
  {
    id: 'autonomia',
    pregunta: '¿Cómo se maneja en el día a día?',
    ayuda: 'Para asearse, vestirse y comer.',
    opciones: [
      { valor: 'autonoma', etiqueta: 'Se vale por sí misma', frase: 'es autónoma para las actividades del día a día' },
      { valor: 'ayuda-poca', etiqueta: 'Necesita algo de ayuda', frase: 'necesita ayuda puntual para asearse o vestirse' },
      { valor: 'ayuda-mucha', etiqueta: 'Necesita ayuda para casi todo', frase: 'necesita ayuda para casi todas las actividades básicas' },
      { valor: 'encamada', etiqueta: 'Está encamada', frase: 'está encamada y requiere atención completa' },
    ],
  },
  {
    id: 'movilidad',
    pregunta: '¿Cómo se desplaza?',
    opciones: [
      { valor: 'camina', etiqueta: 'Camina sin ayuda', frase: 'camina sin ayuda' },
      { valor: 'apoyo', etiqueta: 'Con bastón o andador', frase: 'camina con bastón o andador' },
      { valor: 'silla', etiqueta: 'En silla de ruedas', frase: 'se desplaza en silla de ruedas' },
      { valor: 'no-se-levanta', etiqueta: 'No se levanta de la cama', frase: 'no se levanta de la cama' },
    ],
  },
  {
    id: 'cognitivo',
    pregunta: '¿Hay problemas de memoria o desorientación?',
    opciones: [
      { valor: 'no', etiqueta: 'No', frase: 'no presenta deterioro cognitivo' },
      { valor: 'leve', etiqueta: 'Despistes leves', frase: 'tiene despistes leves de memoria' },
      { valor: 'diagnostico', etiqueta: 'Demencia o alzhéimer diagnosticado', frase: 'tiene un diagnóstico de demencia o alzhéimer' },
      { valor: 'deambulacion', etiqueta: 'Se desorienta y tiende a salir', frase: 'se desorienta y tiende a salir sola, por lo que necesita una unidad cerrada' },
    ],
  },
  {
    id: 'sanitario',
    pregunta: '¿Necesita algún cuidado sanitario especial?',
    ayuda: 'Puedes marcar varios.',
    multiple: true,
    opciones: [
      { valor: 'ninguno', etiqueta: 'Ninguno', frase: '' },
      { valor: 'curas', etiqueta: 'Curas o úlceras', frase: 'curas de úlceras' },
      { valor: 'sonda', etiqueta: 'Sonda', frase: 'sonda' },
      { valor: 'oxigeno', etiqueta: 'Oxígeno', frase: 'oxigenoterapia' },
      { valor: 'diabetes', etiqueta: 'Diabetes con insulina', frase: 'control de diabetes con insulina' },
      { valor: 'neurologico', etiqueta: 'Párkinson o secuelas de ictus', frase: 'seguimiento por párkinson o secuelas de ictus' },
    ],
  },
  {
    id: 'conducta',
    pregunta: '¿Hay alteraciones de conducta?',
    opciones: [
      { valor: 'no', etiqueta: 'No', frase: '' },
      { valor: 'agitacion', etiqueta: 'Agitación o agresividad', frase: 'presenta episodios de agitación' },
      { valor: 'animo', etiqueta: 'Depresión o ansiedad', frase: 'presenta depresión o ansiedad' },
    ],
  },
  {
    id: 'grado',
    pregunta: '¿Tiene grado de dependencia reconocido?',
    opciones: [
      { valor: 'no', etiqueta: 'No tiene', frase: 'no tiene grado de dependencia reconocido' },
      { valor: 'tramite', etiqueta: 'En trámite', frase: 'tiene la valoración de dependencia en trámite' },
      { valor: '1', etiqueta: 'Grado I', frase: 'tiene reconocido el grado I de dependencia' },
      { valor: '2', etiqueta: 'Grado II', frase: 'tiene reconocido el grado II de dependencia' },
      { valor: '3', etiqueta: 'Grado III', frase: 'tiene reconocido el grado III de dependencia' },
      { valor: 'nose', etiqueta: 'No lo sé', frase: '' },
    ],
  },
] as const;

/** Tipo de estancia — hoy va implícito en el texto libre (269 menciones de temporal/respiro). */
export const TIPOS_ESTANCIA = [
  { valor: 'permanente', etiqueta: 'Permanente', frase: 'Busca plaza permanente' },
  { valor: 'temporal', etiqueta: 'Temporal o convalecencia', frase: 'Busca una estancia temporal o de convalecencia' },
  { valor: 'respiro', etiqueta: 'Respiro familiar', frase: 'Busca una plaza de respiro familiar' },
] as const;

/** Rangos de precio: 4 opciones en vez de las 14 del select de producción. */
export const RANGOS_PRECIO = [
  { valor: '0-1500', etiqueta: 'Menos de 1.500 €', precioMaximo: '1500' },
  { valor: '1500-2000', etiqueta: '1.500 – 2.000 €', precioMaximo: '2000' },
  { valor: '2000-2500', etiqueta: '2.000 – 2.500 €', precioMaximo: '2500' },
  { valor: '2500+', etiqueta: 'Más de 2.500 €', precioMaximo: '*' },
  { valor: 'nose', etiqueta: 'Todavía no lo sé', precioMaximo: '*' },
] as const;

export interface DatosPersona {
  genero?: 'M' | 'H' | 'P';
  edad?: string;
  estancia?: string;
  cuando?: string;
  /** Texto libre OPCIONAL: lo que el usuario quiera añadir por su cuenta. */
  libre?: string;
}

/** Respuestas del perfil: id de pregunta → valor (o valores, si es múltiple). */
export type RespuestasPerfil = Record<string, string | string[] | undefined>;

function sujeto(genero?: 'M' | 'H' | 'P', edad?: string): string {
  const n = Number(edad);
  const anios = Number.isFinite(n) && n > 0 ? ` de ${n} años` : '';
  if (genero === 'P') return `Pareja${anios ? ` de aproximadamente${anios.replace(' de', '')}` : ''}`;
  if (genero === 'H') return `Hombre${anios}`;
  return `Mujer${anios}`;
}

/** Une fragmentos con comas y una "y" final: ["a","b","c"] → "a, b y c". */
function enumerar(partes: readonly string[]): string {
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Compone la descripción en prosa que viaja en `buscadorProactivo.personaNecesidades`.
 * El resultado es deliberadamente parecido a lo que escribe una persona, para que la
 * trabajadora social y el matching automático lo lean igual que hoy.
 */
export function componerDescripcion(respuestas: RespuestasPerfil, datos: DatosPersona = {}): string {
  const frases: string[] = [];

  const estado: string[] = [];
  for (const id of ['autonomia', 'movilidad', 'cognitivo']) {
    const pregunta = PREGUNTAS_PERFIL.find((p) => p.id === id);
    const valor = respuestas[id];
    if (!pregunta || typeof valor !== 'string') continue;
    const frase = pregunta.opciones.find((o) => o.valor === valor)?.frase;
    if (frase) estado.push(frase);
  }
  const quien = sujeto(datos.genero, datos.edad);
  frases.push(estado.length ? `${quien}: ${enumerar(estado)}.` : `${quien}.`);

  const sanitario = respuestas['sanitario'];
  const cuidados = Array.isArray(sanitario) ? sanitario : sanitario ? [sanitario] : [];
  const frasesSanitarias = cuidados
    .map((v) => PREGUNTAS_PERFIL.find((p) => p.id === 'sanitario')?.opciones.find((o) => o.valor === v)?.frase)
    .filter((f): f is string => Boolean(f));
  if (frasesSanitarias.length) {
    frases.push(`Necesita ${enumerar(frasesSanitarias)}.`);
  }

  const conducta = respuestas['conducta'];
  if (typeof conducta === 'string') {
    const frase = PREGUNTAS_PERFIL.find((p) => p.id === 'conducta')?.opciones.find((o) => o.valor === conducta)?.frase;
    if (frase) frases.push(`${mayuscula(frase)}.`);
  }

  const grado = respuestas['grado'];
  if (typeof grado === 'string') {
    const frase = PREGUNTAS_PERFIL.find((p) => p.id === 'grado')?.opciones.find((o) => o.valor === grado)?.frase;
    if (frase) frases.push(`${mayuscula(frase)}.`);
  }

  const estancia = TIPOS_ESTANCIA.find((t) => t.valor === datos.estancia);
  if (estancia || datos.cuando) {
    const base = estancia?.frase ?? 'Busca plaza';
    frases.push(datos.cuando ? `${base}; ${datos.cuando.toLowerCase()}.` : `${base}.`);
  }

  const libre = datos.libre?.trim();
  if (libre) frases.push(libre.endsWith('.') ? libre : `${libre}.`);

  return frases.join(' ');
}

/**
 * Convierte las respuestas del prototipo a los campos que espera el monolito hoy
 * (`CamposProactivo` de `contrato.ts`).
 */
export function aCamposProactivo(respuestas: RespuestasPerfil, datos: DatosPersona): Record<string, string> {
  return {
    'buscadorProactivo.personaNecesidades': componerDescripcion(respuestas, datos),
    'buscadorProactivo.genero': datos.genero ?? 'M',
    'buscadorProactivo.personaEdad': datos.edad ?? '',
    'buscadorProactivo.personaCuando': datos.cuando ?? '',
  };
}

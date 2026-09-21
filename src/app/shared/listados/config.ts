/**
 * Familias de listados por faceta (RP-02 + anexo de facetas realistas). Portado literal
 * de src/lib/listados/config.ts. Una entrada por familia de URL raíz:
 * `/{slugFamilia}/{provincia}`. Todas comparten el molde: umbral ≥5, solo "Sí" explícito,
 * metodología visible, cifra única con fecha, FAQPage, ItemList.
 */

export interface FamiliaListado {
  faceta: string; // clave en DocIndice.facetas
  titulo: string; // "Residencias concertadas y con plazas públicas"
  fraseDato: string; // "declaran disponer de plazas de financiación pública"
  fraseCorta: string; // para enlaces: "Concertadas"
  queEsPregunta: string;
  queEsRespuesta: string;
  descripcionMeta: string; // segunda frase de la meta description
}

export const FAMILIAS_LISTADO: Record<string, FamiliaListado> = {
  'residencias-concertadas': {
    faceta: 'concertada',
    titulo: 'Residencias concertadas y con plazas públicas',
    fraseDato: 'declaran disponer de plazas de financiación pública',
    fraseCorta: 'Concertadas y con plazas públicas',
    queEsPregunta: '¿Qué es una plaza concertada?',
    queEsRespuesta:
      'Una plaza en una residencia privada financiada total o parcialmente por la ' +
      'administración pública. El acceso se tramita a través de los servicios sociales ' +
      '(ley de dependencia); el copago depende de la comunidad autónoma y de la renta ' +
      'de la persona usuaria.',
    descripcionMeta: 'Listado verificado con datos de los propios centros: plazas, precios e índice de transparencia.',
  },
  'residencias-sin-sujeciones': {
    faceta: 'sin-sujeciones',
    titulo: 'Residencias sin sujeciones',
    fraseDato: 'declaran una política de eliminación de sujeciones (atención centrada en la persona)',
    fraseCorta: 'Sin sujeciones',
    queEsPregunta: '¿Qué es una residencia sin sujeciones?',
    queEsRespuesta:
      'Un centro con una política activa de eliminación de sujeciones físicas y químicas ' +
      'en el cuidado de las personas mayores, sustituyéndolas por prevención, supervisión ' +
      'y adaptación del entorno (modelo de atención centrada en la persona). Es un ' +
      'indicador de calidad asistencial reconocido internacionalmente.',
    descripcionMeta: 'Atención centrada en la persona con datos verificables de los propios centros.',
  },
  'residencias-con-unidad-de-demencia': {
    faceta: 'unidad-demencia',
    titulo: 'Residencias con unidad de demencia',
    fraseDato: 'declaran disponer de una unidad especializada en demencias (alzhéimer y otros deterioros cognitivos)',
    fraseCorta: 'Con unidad de demencia',
    queEsPregunta: '¿Qué es una unidad de demencia?',
    queEsRespuesta:
      'Un área o programa especializado para personas con alzhéimer u otras demencias: ' +
      'espacios adaptados y seguros (control de deambulación), personal formado en ' +
      'psicogeriatría y actividades de estimulación cognitiva. Al visitarla, conviene ' +
      'preguntar por la ratio de personal de la unidad y su formación específica.',
    descripcionMeta: 'Con plazas, precios y transparencia de cada centro.',
  },
  'residencias-adaptadas-silla-de-ruedas': {
    faceta: 'silla-ruedas',
    titulo: 'Residencias adaptadas para silla de ruedas',
    fraseDato: 'declaran admitir a personas en silla de ruedas',
    fraseCorta: 'Adaptadas a silla de ruedas',
    queEsPregunta: '¿Qué debe tener una residencia adaptada a silla de ruedas?',
    queEsRespuesta:
      'Accesos y pasillos sin barreras, ascensores amplios, baños geriátricos adaptados y ' +
      'ayudas técnicas para las transferencias (grúas). En la visita conviene comprobar el ' +
      'acceso a zonas comunes, comedor y jardín, no solo a la habitación.',
    descripcionMeta: 'Accesibilidad declarada por los propios centros, con plazas y precios.',
  },
  'residencias-para-personas-encamadas': {
    faceta: 'encamados',
    titulo: 'Residencias que admiten personas encamadas',
    fraseDato: 'declaran admitir a personas encamadas',
    fraseCorta: 'Admiten personas encamadas',
    queEsPregunta: '¿Qué cuidados necesita una persona encamada en una residencia?',
    queEsRespuesta:
      'Cambios posturales pautados, prevención de úlceras por presión (camas articuladas y ' +
      'colchones antiescaras), higiene asistida y supervisión de enfermería. Conviene ' +
      'preguntar por el protocolo de prevención de úlceras y la ratio de personal en turnos ' +
      'de noche.',
    descripcionMeta: 'Grandes dependientes: centros que lo declaran expresamente, con datos.',
  },
  'residencias-con-atencion-medica': {
    faceta: 'medico-propio',
    titulo: 'Residencias con médico propio',
    fraseDato: 'declaran contar con médico propio en su equipo profesional',
    fraseCorta: 'Con médico propio',
    queEsPregunta: '¿Qué aporta que la residencia tenga médico propio?',
    queEsRespuesta:
      'Seguimiento clínico continuado sin depender solo del centro de salud: revisión de ' +
      'pautas de medicación, coordinación con especialistas y hospital, y respuesta más ' +
      'rápida ante cambios de estado. Complementa (no sustituye) a la sanidad pública.',
    descripcionMeta: 'Supervisión sanitaria declarada por los propios centros.',
  },
  'residencias-con-enfermeria': {
    faceta: 'enfermeria-propia',
    titulo: 'Residencias con enfermería propia',
    fraseDato: 'declaran contar con personal de enfermería propio',
    fraseCorta: 'Con enfermería propia',
    queEsPregunta: '¿Por qué importa la enfermería propia en una residencia?',
    queEsRespuesta:
      'La enfermería propia permite administrar medicación compleja, curas y seguimiento ' +
      'diario dentro del centro. Conviene preguntar si hay cobertura de enfermería también ' +
      'en fines de semana y turnos de noche.',
    descripcionMeta: 'Cuidados de enfermería declarados por los propios centros.',
  },
  'residencias-acreditadas-ley-dependencia': {
    faceta: 'acreditada-dependencia',
    titulo: 'Residencias acreditadas por la ley de dependencia',
    fraseDato: 'declaran estar acreditadas para la ley de dependencia',
    fraseCorta: 'Acreditadas ley de dependencia',
    queEsPregunta: '¿Qué significa que una residencia esté acreditada por la ley de dependencia?',
    queEsRespuesta:
      'Que cumple los requisitos de su comunidad autónoma para atender plazas vinculadas a ' +
      'las prestaciones de la ley de dependencia (como la prestación vinculada al servicio). ' +
      'Permite financiar parte del coste con esas ayudas; el trámite se hace en servicios ' +
      'sociales.',
    descripcionMeta: 'Compatibles con las ayudas de la dependencia, según declaración del centro.',
  },
  'residencias-con-certificado-de-calidad': {
    faceta: 'certificado-calidad',
    titulo: 'Residencias con certificado de calidad',
    fraseDato: 'declaran disponer de una certificación de calidad (ISO u otras)',
    fraseCorta: 'Con certificado de calidad',
    queEsPregunta: '¿Qué valor tiene un certificado de calidad en una residencia?',
    queEsRespuesta:
      'Indica que un tercero audita periódicamente los procesos del centro (por ejemplo ' +
      'ISO 9001 u otros sellos del sector). No garantiza por sí solo un buen trato, pero ' +
      'añade control externo; conviene preguntar qué certificado es y cuándo se renovó.',
    descripcionMeta: 'Certificaciones declaradas por los propios centros, con sus datos.',
  },
};

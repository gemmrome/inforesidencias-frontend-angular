/**
 * EL VÍNCULO entre un centro de Inforesidencias y una residencia de «Aquí se come
 * bien». Portado LITERAL de src/lib/adapter/comida-correlacion.ts, incluido el mapa de
 * datos: es exactamente la misma decisión editada por una persona, no algo que un
 * puerto a otro framework deba tocar.
 *
 * POR QUÉ ESTO EXISTE Y NO SE INFIERE: el emparejamiento automático por nombre +
 * provincia dio un 38% de acierto sobre las 21 residencias del origen, y el modo de
 * fallo no es benigno (ver la cabecera del fichero original para el caso «Los Olivos»).
 * Por eso el vínculo es EXPLÍCITO y revisado por una persona.
 */

export interface VinculoComida {
  /** UUID de la residencia en el origen. */
  residenciaId: string;
  /** Nombre en el origen — solo para que un humano audite el par de un vistazo. */
  nombreEnOrigen: string;
  /** ¿La residencia ha consentido que sus fotos se publiquen en inforesidencias.com?
   *  En producción solo se publica lo `otorgado`. */
  consentimiento: 'otorgado' | 'pendiente';
  /** Quién verificó el par y contra qué. */
  verificadoPor: string;
}

const VINCULOS: Record<number, VinculoComida> = {
  // Verificado a mano el 2026-08-14 (única residencia con volumen real: 48 fotos
  // aprobadas, 2 menús con PDF, 5 fotos de cocina). Ver la cabecera del fichero
  // original para el porqué completo de "pendiente" en preproducción.
  7181: {
    residenciaId: '4b5b92ca-8ee0-466f-8cbd-db3886526180',
    nombreEnOrigen: 'Hospital Asilo de Luarca',
    consentimiento: 'pendiente',
    verificadoPor: 'PM 2026-08-14 · consulta a la BD del origen + índice del clon',
  },
};

/** El vínculo de un centro, o `null` si no lo tiene. Función pura y síncrona. */
export function residenciaDeCentro(centroId: number): VinculoComida | null {
  return VINCULOS[centroId] ?? null;
}

/** Solo para las pruebas y para auditar el mapa. */
export function vinculosDeComida(): ReadonlyArray<[number, VinculoComida]> {
  return Object.entries(VINCULOS).map(([id, v]) => [Number(id), v]);
}

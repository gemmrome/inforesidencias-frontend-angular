import './server-only';

/**
 * Carga `.env.local` (si existe) en `process.env` ANTES de que se evalúe cualquier otro
 * módulo de `src/server/` — varios leen `process.env` en su propio top-level
 * (`src/server/config/entorno.ts`, por ejemplo, calcula `ENTORNO`/`ES_INDEXABLE` en
 * cuanto se importa). Por eso este fichero es SIEMPRE el PRIMER import de
 * `src/server.ts`: en los módulos de ES el orden de los `import` es el orden real de
 * evaluación, y si esto se importara después ya sería tarde para los módulos que ya se
 * hubieran evaluado con `process.env` a medias.
 *
 * DEFECTO CORREGIDO (2026-09-20): nada en el proyecto cargaba `.env.local` — el
 * fichero existía y `.env.example` decía "cópialo a .env.local", pero solo
 * `npm run sync:*` funcionaba con él porque esos scripts se invocan sueltos (con las
 * variables ya puestas a mano en la sesión de turno). En cuanto una petición real
 * necesitó llamar a la API en caliente (`getCentro`, la ficha de centro), reventó con
 * "Falta API_KEY_API_IR en el entorno" pese a tenerlo escrito en `.env.local`, porque
 * `ng serve`/`node server.mjs` nunca lo habían leído.
 *
 * `process.loadEnvFile` es nativo desde Node 20.6 (este proyecto pide Node ≥22.20): no
 * hace falta añadir la dependencia `dotenv`. Como NO sobrescribe una variable que el
 * entorno YA tenga puesta (systemd, Docker, la propia shell…), es seguro llamarlo
 * también en producción — gana el entorno real si existe, y si no hay `.env.local`
 * (lo esperable en producción) simplemente no hace nada.
 */
try {
  process.loadEnvFile('.env.local');
} catch {
  // No existe .env.local (producción con las variables puestas en el entorno, o
  // desarrollo sin configurar todavía): no es un error, solo se sigue sin él.
}

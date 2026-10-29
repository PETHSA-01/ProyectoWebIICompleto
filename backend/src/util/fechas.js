// Utilidades de fecha para la API GraphQL.
//
// Postgres devuelve TIMESTAMPTZ como Date de JS y DATE como Date a medianoche
// local; el serializador String de GraphQL los convierte a epoch-ms
// ("1792537141144"), que el navegador NO puede pasar directo a `new Date()`
// (lo interpreta como año fuera de rango y da Invalid Date). Por eso todos los
// resolvers de fecha devuelven ISO 8601.

/** TIMESTAMPTZ -> "2026-10-20T18:31:11.000Z" (o el string tal cual). */
export function fechaHora(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'number') return new Date(valor).toISOString();
  const texto = String(valor);
  // Epoch en ms serializado por versiones anteriores.
  if (/^\d{10,}$/.test(texto)) return new Date(Number(texto)).toISOString();
  return texto;
}

/** DATE -> "2026-10-24" (sin corrimiento de zona horaria). */
export function fechaDia(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'string') return valor.slice(0, 10);
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Pool de conexiones a Postgres. Reemplaza al better-sqlite3 de la practica
// P2-6: aqui las consultas son asincronas (async/await) en vez de sincronas,
// y en lugar de "prepared statements" reutilizables se usan queries
// parametrizadas ($1, $2, ...) que el driver pg prepara internamente.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Un error en un cliente inactivo del pool no deberia tumbar el servidor.
  console.error('Error inesperado en el pool de Postgres:', err);
});

/**
 * Helper corto para correr una query y devolver solo las filas (rows).
 * Equivalente a lo que antes hacian los .all()/.get() de better-sqlite3.
 */
export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Igual que query(), pero devuelve solo la primera fila (o null).
 * Equivalente al .get() de better-sqlite3.
 */
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/**
 * Ejecuta una funcion dentro de una transaccion real de Postgres
 * (BEGIN/COMMIT/ROLLBACK), tomando un cliente dedicado del pool.
 * Reemplaza a db.transaction(...) de better-sqlite3.
 *
 * La funcion callback recibe un "client" con el mismo query()/queryOne()
 * de arriba, pero ligado a ESA conexion (necesario para que todo corra
 * dentro de la misma transaccion).
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  const scoped = {
    query: (text, params) => client.query(text, params).then((r) => r.rows),
    queryOne: (text, params) =>
      client.query(text, params).then((r) => r.rows[0] ?? null),
  };
  try {
    await client.query('BEGIN');
    const resultado = await callback(scoped);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

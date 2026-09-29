import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './src/schema.js';
import { resolvers } from './src/resolvers.js';
import { crearContext } from './src/auth/context.js';
import { pool } from './src/db.js';

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = process.env.PORT || 4001;

// Verificamos la conexion a Postgres antes de levantar el servidor, para
// fallar rapido y con un mensaje claro si DATABASE_URL esta mal.
await pool.query('SELECT 1');

const { url } = await startStandaloneServer(server, {
  listen: { port: Number(port) },
  context: crearContext,
});

console.log(`Servidor GraphQL del Proyecto Final listo en ${url}`);

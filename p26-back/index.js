import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './src/schema.js';
import { resolvers } from './src/resolvers.js';
import './src/db.js'; // se asegura de inicializar la base antes de arrancar

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = process.env.PORT || 4001;

const { url } = await startStandaloneServer(server, {
  listen: { port: Number(port) },
});

console.log(`Servidor GraphQL de P2-6 listo en ${url}`);

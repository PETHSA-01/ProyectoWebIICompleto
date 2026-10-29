import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './src/schema.js';
import { resolvers } from './src/resolvers.js';
import { crearContext } from './src/auth/context.js';
import { pool } from './src/db.js';
import { obtenerPago, validarFirmaWebhook } from './src/pagos/mercadopago.js';
import { consultarOrden } from './src/pagos/paypal.js';
import { marcarPagoAprobado } from './src/pagos/estado-pedido.js';

const app = express();
app.use(express.json());

// Verificamos la conexion a Postgres antes de levantar el servidor, para
// fallar rapido y con un mensaje claro si DATABASE_URL esta mal.
await pool.query('SELECT 1');

// Servidor HTTP propio para compartir el puerto entre Express (consultas y
// mutaciones) y el WebSocket de las suscripciones (graphql-ws, ruta /graphql).
const httpServer = http.createServer(app);
const schema = makeExecutableSchema({ typeDefs, resolvers });

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
const cerrarWs = useServer({ schema }, wsServer);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return { drainServer: async () => cerrarWs.dispose() };
      },
    },
  ],
});
await server.start();

app.use('/graphql', expressMiddleware(server, { context: crearContext }));

// --- Webhook Mercado Pago (Checkout API) ---------------------------------
// Mercado Pago notifica aqui cada vez que un pago cambia de estado. En
// sandbox local no hay URL publica para que lleguen (se usa la verificacion
// por API al volver en /pago/resultado), pero el endpoint queda listo para
// cuando el backend este desplegado o usando ngrok.
app.post('/api/pagos/mercadopago/webhook', async (req, res) => {
  const { data, type } = req.body || {};
  const dataId = data?.id;

  if (type !== 'payment' || !dataId) {
    return res.status(400).json({ ok: false, error: 'Notificacion desconocida.' });
  }

  const valida = validarFirmaWebhook({
    xSignature: req.get('x-signature'),
    xRequestId: req.get('x-request-id'),
    dataId,
  });
  if (process.env.MP_WEBHOOK_SECRET && !valida) {
    return res.status(401).json({ ok: false, error: 'Firma invalida.' });
  }

  try {
    const pago = await obtenerPago(dataId);
    const pedidoId = Number(pago.external_reference);
    if (pedidoId && pago.status === 'approved') {
      await marcarPagoAprobado(pedidoId, { metodoPago: 'MERCADO_PAGO', idPago: dataId });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook Mercado Pago fallo:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Webhook PayPal (Orders API) -----------------------------------------
// PayPal no envia el estado final por webhook para Orders v2 de la misma
// forma; se usa la verificacion al volver. Este endpoint existe por
// completitud y para la consulta manual de una orden aprobada.
app.post('/api/pagos/paypal/webhook', async (req, res) => {
  const { orderId, pedidoId } = req.body || {};
  if (!orderId || !pedidoId) {
    return res.status(400).json({ ok: false, error: 'Faltan orderId y pedidoId.' });
  }
  try {
    const orden = await consultarOrden(orderId);
    if (orden.estado === 'COMPLETED') {
      await marcarPagoAprobado(Number(pedidoId), { metodoPago: 'PAYPAL', idPago: orderId });
      return res.status(200).json({ ok: true, estado: 'COMPLETED' });
    }
    return res.status(200).json({ ok: true, estado: orden.estado });
  } catch (err) {
    console.error('Webhook PayPal fallo:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const port = process.env.PORT || 4001;
httpServer.listen(port, () => {
  console.log(`Servidor GraphQL del Proyecto Final listo en http://localhost:${port}/graphql`);
});
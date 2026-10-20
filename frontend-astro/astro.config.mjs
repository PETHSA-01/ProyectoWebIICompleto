import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';

// Salida "server": Home/Categoria/Producto se renderizan en el servidor en
// cada peticion (SSR), consultando el backend GraphQL con datos siempre
// frescos (stock, precios), en vez de quedar fijos como en un build
// estatico. /api/graphql y /auth/sesion son rutas de servidor (cookies
// httpOnly, nonce CSRF) que Netlify convierte en funciones serverless
// automaticamente gracias a este adapter.
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [react()],
});

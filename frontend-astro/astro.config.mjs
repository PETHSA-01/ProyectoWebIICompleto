import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';

// Salida "server": Home/Categoria/Producto se renderizan en el servidor en
// cada peticion (SSR), consultando el backend GraphQL con datos siempre
// frescos (stock, precios), en vez de quedar fijos como en un build
// estatico. Los unicos pedazos interactivos (carrito, checkout, login con
// Google) se hidratan en el cliente como "islas" de React.
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [react()],
});

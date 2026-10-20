// Config TEMPORAL para desarrollo local (pruebas de escritorio), evita el
// adapter de Netlify. NO usar en produccion; se borra al terminar.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  integrations: [react()],
  vite: {
    // Cache de depancias propio de dev: 'astro build' reescribe el cache
    // compartido (node_modules/.vite/deps) y deja sin nanostores al dev
    // server, causando "504 Outdated Optimize Dep" y fallos de hidratacion.
    cacheDir: 'node_modules/.vite-dev',
    optimizeDeps: {
      // Fuerza que estas libs ESM queden siempre en el optimizador en vez de
      // depender del escaneo de entradas (que las descartaba).
      include: ['nanostores', '@nanostores/react', '@nanostores/persistent'],
    },
  },
});
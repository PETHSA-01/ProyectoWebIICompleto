import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_C7v7as64.mjs';
import { manifest } from './manifest_BrU_OPoy.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/graphql.astro.mjs');
const _page2 = () => import('./pages/auth/sesion.astro.mjs');
const _page3 = () => import('./pages/carrito.astro.mjs');
const _page4 = () => import('./pages/categoria/_id_.astro.mjs');
const _page5 = () => import('./pages/producto/_id_.astro.mjs');
const _page6 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/node.js", _page0],
    ["src/pages/api/graphql.js", _page1],
    ["src/pages/auth/sesion.js", _page2],
    ["src/pages/carrito.astro", _page3],
    ["src/pages/categoria/[id].astro", _page4],
    ["src/pages/producto/[id].astro", _page5],
    ["src/pages/index.astro", _page6]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/dist/client/",
    "server": "file:///home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/dist/server/",
    "host": false,
    "port": 4321,
    "assets": "_astro",
    "experimentalStaticHeaders": false
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };

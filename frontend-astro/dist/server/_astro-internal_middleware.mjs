import { e as defineMiddleware, s as sequence } from './chunks/render-context_xW8Q-RGK.mjs';
import { l as leerCookieSesion, t as tokenCaducado } from './chunks/sesion_uA2PStyq.mjs';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_B4Pu-php.mjs';
import 'piccolore';
import './chunks/astro/server_Cpc1lNFO.mjs';
import 'clsx';

// Corre en el servidor, antes de cada peticion y antes de renderizar
// cualquier pagina .astro. Lee la cookie de sesion una sola vez y la deja en
// Astro.locals.sesion, para que el layout y las paginas sepan quien esta
// conectado sin tener que pegarle al backend.

const onRequest$1 = defineMiddleware(async (context, next) => {
  const sesion = leerCookieSesion(context.cookies);

  // Un JWT caducado se descarta en el momento: se borra la cookie para no
  // seguir reenviando un token que el backend va a rechazar. Se distingue
  // "sin sesion" de "sesion vencida" para que la isla pueda avisarle a la
  // persona en vez de dejarla pensando que nunca hizo login.
  if (sesion && tokenCaducado(sesion.token)) {
    context.cookies.delete('nexoplay_sesion', { path: '/' });
    context.locals.sesion = null;
    context.locals.sesionCaducada = true;
  } else {
    context.locals.sesion = sesion;
    context.locals.sesionCaducada = false;
  }

  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };

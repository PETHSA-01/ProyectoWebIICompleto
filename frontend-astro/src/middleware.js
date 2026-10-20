// Corre en el servidor, antes de cada peticion y antes de renderizar
// cualquier pagina .astro. Lee la cookie de sesion una sola vez y la deja en
// Astro.locals.sesion, para que el layout y las paginas sepan quien esta
// conectado sin tener que pegarle al backend.
import { defineMiddleware } from 'astro:middleware';
import { leerCookieSesion, tokenCaducado } from './lib/sesion.js';

export const onRequest = defineMiddleware(async (context, next) => {
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

  // Las rutas /admin/* son el dashboard del panel: exigen sesion con rol
  // ADMIN u OPERADOR. Cualquier otra visita acaba en /login.
  if (context.url.pathname.startsWith('/admin')) {
    const rol = context.locals.sesion?.usuario?.rol;
    if (!rol || !['ADMIN', 'OPERADOR'].includes(rol)) {
      return context.redirect('/login');
    }
  }

  return next();
});

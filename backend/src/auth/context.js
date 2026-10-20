import { extraerTokenDeHeader, verificarToken } from './jwt.js';

/**
 * Construye el "context" que Apollo pasa a cada resolver, a partir del
 * header Authorization de la peticion HTTP. Si no hay token o es invalido,
 * el usuario queda como null (peticion anonima).
 */
export async function crearContext({ req }) {
  const token = extraerTokenDeHeader(req.headers.authorization);
  const payload = verificarToken(token);

  if (!payload) {
    return { usuario: null };
  }

  return {
    usuario: {
      id: Number(payload.sub),
      rol: payload.rol,
      nombre: payload.nombre,
      email: payload.email,
    },
  };
}

/** Lanza si no hay sesion. Usar al inicio de resolvers que requieren login. */
export function requerirUsuario(context) {
  if (!context.usuario) {
    throw new Error('Necesitas iniciar sesion para hacer esto.');
  }
  return context.usuario;
}

/** Lanza si no hay sesion o el usuario no es ADMIN. */
export function requerirAdmin(context) {
  const usuario = requerirUsuario(context);
  if (usuario.rol !== 'ADMIN') {
    throw new Error('Esta accion requiere permisos de administrador.');
  }
  return usuario;
}

/**
 * Lanza si no hay sesion o el usuario no pertenece al equipo del panel
 * administrativo (ADMIN u OPERADOR). Cubre Dashboard y gestion de ordenes;
 * las operaciones exclusivas de dueno siguen exigiendo requerirAdmin().
 */
export function requerirPanel(context) {
  const usuario = requerirUsuario(context);
  if (usuario.rol !== 'ADMIN' && usuario.rol !== 'OPERADOR') {
    throw new Error('Necesitas permisos de administrador u operador para esto.');
  }
  return usuario;
}

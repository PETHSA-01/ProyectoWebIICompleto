import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET) {
  throw new Error('Falta JWT_SECRET en las variables de entorno.');
}

/**
 * Un mismo token JWT autoriza DOS sistemas distintos:
 *
 *  - Este backend GraphQL: lee el claim "rol" (ADMIN | OPERADOR | CLIENTE)
 *    para decidir que puede hacer el usuario en los resolvers.
 *  - PostgREST: lee el claim estandar "role", y antes de correr cada
 *    query hace "SET ROLE <valor>", cambiando a ese rol de Postgres
 *    (ver postgrest.conf y las policies de RLS en db/init.sql).
 *
 * Por eso el payload trae ambos nombres aunque representen lo mismo,
 * con vocabularios distintos (negocio vs. roles de base de datos).
 */
export function firmarToken(usuario) {
  // El equipo del panel (ADMIN y OPERADOR) mapea al rol de BD "web_admin",
  // que tiene CRUD completo y visibilidad total; los clientes a "web_user".
  const rolDb = usuario.rol === 'CLIENTE' ? 'web_user' : 'web_admin';

  const payload = {
    sub: String(usuario.id), // PostgREST usa "sub" en las policies de RLS
    role: rolDb, // claim que PostgREST usa para SET ROLE
    rol: usuario.rol, // claim que usan los resolvers de GraphQL (ADMIN/CLIENTE)
    nombre: usuario.nombre,
    email: usuario.email,
  };

  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Verifica y decodifica el token. Devuelve null si es invalido o no vino.
 * Nunca lanza: un token invalido simplemente deja al usuario sin sesion
 * (equivalente a una peticion anonima / rol web_anon en PostgREST).
 */
export function verificarToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

/**
 * Extrae el token del header "Authorization: Bearer <token>".
 */
export function extraerTokenDeHeader(authHeader) {
  if (!authHeader) return null;
  const [tipo, token] = authHeader.split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  return token;
}

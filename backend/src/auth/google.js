import { OAuth2Client } from 'google-auth-library';
import { queryOne } from '../db.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

/**
 * Verifica un ID token de Google (el que entrega Google Identity Services
 * en el navegador, vía el boton "Sign in with Google") y devuelve los
 * datos basicos del perfil, ya validados por Google (firma, audiencia,
 * expiracion). Lanza si el token no es valido.
 */
export async function verificarIdTokenGoogle(idToken) {
  if (!CLIENT_ID) {
    throw new Error('Falta GOOGLE_CLIENT_ID en las variables de entorno.');
  }
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('El token de Google no trajo los datos esperados.');
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    nombre: payload.name || payload.email,
    avatarUrl: payload.picture || null,
  };
}

/**
 * Busca un usuario por google_id; si no existe, revisa si ya hay un
 * usuario LOCAL con ese email (para no duplicar cuentas) y lo "conecta"
 * a Google; si tampoco existe, crea uno nuevo con auth_provider = GOOGLE.
 *
 * Este es el unico lugar donde se hace el "upsert" de usuarios de Google,
 * para mantener la logica de alta/vinculacion en un solo sitio.
 */
export async function buscarOCrearUsuarioGoogle({ googleId, email, nombre, avatarUrl }) {
  const porGoogleId = await queryOne(
    'SELECT * FROM usuarios WHERE google_id = $1',
    [googleId]
  );
  if (porGoogleId) {
    // Re-login con la MISMA cuenta Google: refrescamos nombre y avatar desde
    // el ID token, por si los cambio en su cuenta de Google (p. ej. la foto
    // de perfil). Sin este UPDATE, un usuario existente conservaria para
    // siempre la URL de avatar original.
    return queryOne(
      `UPDATE usuarios
         SET nombre = $1, avatar_url = $2
       WHERE google_id = $3
       RETURNING *`,
      [nombre, avatarUrl, googleId]
    );
  }

  const porEmail = await queryOne('SELECT * FROM usuarios WHERE email = $1', [email]);
  if (porEmail) {
    // Cuenta LOCAL preexistente con el mismo correo: la vinculamos a Google
    // en vez de crear un usuario duplicado.
    return queryOne(
      `UPDATE usuarios
         SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), auth_provider = 'GOOGLE'
       WHERE id = $3
       RETURNING *`,
      [googleId, avatarUrl, porEmail.id]
    );
  }

  return queryOne(
    `INSERT INTO usuarios (nombre, email, google_id, avatar_url, auth_provider, rol)
     VALUES ($1, $2, $3, $4, 'GOOGLE', 'CLIENTE')
     RETURNING *`,
    [nombre, email, googleId, avatarUrl]
  );
}

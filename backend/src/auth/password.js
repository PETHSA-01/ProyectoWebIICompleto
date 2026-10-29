// Has de contrasenas con bcrypt (login local con correo/contraseña).
// La practica P2-6 usaba bcryptjs en texto plano ("hashed:admin123"); aqui se
// usa un hash real para que la contrasena nunca viaje ni se guarde legible.
import bcrypt from 'bcryptjs';

const COSTO = 10;

export function crearHash(password) {
  return bcrypt.hash(password, COSTO);
}

export function verificarPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}
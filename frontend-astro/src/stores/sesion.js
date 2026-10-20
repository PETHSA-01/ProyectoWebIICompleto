// Estado de sesion para las islas de React.
//
// Antes guardaba el JWT en localStorage, lo que hacia que cualquier script
// inyectado en la pagina (un XSS) pudiera leerlo y llevarselo. Ahora el token
// vive en una cookie httpOnly y este store solo conserva los datos publicos
// del usuario, que ademas llegan del servidor por props, asi que ni siquiera
// se guardan entre recargas.
import { atom } from 'nanostores';

// En memoria, no "persistentAtom": nada de esto se escribe en disco.
export const $sesion = atom(null);

export function iniciarSesion(usuario) {
  $sesion.set(usuario || null);
}

export function cerrarSesion() {
  $sesion.set(null);
}

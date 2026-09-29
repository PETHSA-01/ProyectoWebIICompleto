import { persistentAtom } from '@nanostores/persistent';

// Guarda el JWT + datos basicos del usuario tras iniciar sesion con Google.
// Igual que $carrito, usa localStorage para compartirse entre la isla de
// login (en el encabezado) y la isla de checkout (que necesita el token
// para llamar a crearPedido).
export const $sesion = persistentAtom('nexoplay:sesion', null, {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export function iniciarSesion({ token, usuario }) {
  $sesion.set({ token, usuario });
}

export function cerrarSesion() {
  $sesion.set(null);
}

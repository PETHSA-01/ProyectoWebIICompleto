// Cierra la sesion local o de Google borrando la cookie httpOnly en el
// servidor. POST /auth/salir no necesita cuerpo y no devuelve nada al
// navegador.
export async function POST({ cookies }) {
  const { borrarCookieSesion } = await import('../../lib/sesion.js');
  borrarCookieSesion(cookies);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
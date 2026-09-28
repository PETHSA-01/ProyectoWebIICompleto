/**
 * Mensaje de error con boton de reintentar (seccion 7.3 de la practica).
 */
export function ErrorMessage({ mensaje, onReintentar }) {
  return (
    <div className="error-mensaje" role="alert">
      <p>No pudimos cargar esta seccion. {mensaje}</p>
      {onReintentar && (
        <button className="boton boton--secundario" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

import estilos from "./Estado.module.css";

export function Cargando({ que = "los datos" }) {
  return (
    <p className={estilos.mensaje}>
      Cargando {que}
      <span aria-hidden="true">…</span>
    </p>
  );
}

export function Error({ mensaje }) {
  return (
    <div className={estilos.error} role="alert">
      <p className="etiquetaCampo">No se pudieron cargar los datos</p>
      <p className={estilos.errorTexto}>{mensaje}</p>
      <p className={estilos.errorNota}>
        La página no muestra cifras parciales: preferimos no mostrar nada antes
        que mostrar un dato incompleto como si fuera completo.
      </p>
    </div>
  );
}

import {
  diasDeCambio,
  diasTexto,
  estadoInstalacion,
  etiquetaCantidadAusente,
  ETIQUETA_TIPO_CAMBIO,
  fechaHoraUTC,
  horaDeCaptura,
  numero,
  tieneDiasRegistrados,
} from "../lib/datos";
import estilos from "./DetalleMedicamento.module.css";

export function AvisoLectura({ metricas, capturas }) {
  const fallidas =
    typeof metricas?.capturas_fallidas === "number"
      ? metricas.capturas_fallidas
      : 0;
  const sinDatoUltima =
    Array.isArray(capturas) &&
    capturas.length > 0 &&
    capturas[capturas.length - 1].ok === false;

  return (
    <section className={estilos.aviso}>
      <p className="etiquetaCampo">Cómo leer esta tabla</p>
      <p className={estilos.avisoTexto}>
        <span className="marca">sin dato</span> significa que la captura de esa
        hora falló y no hay información. No es un cero, no es desabastecimiento
        y no se cuenta como ausencia de existencias.{" "}
        <span className="marca">no listada</span> significa que la captura fue
        exitosa pero la fuente no incluyó esa instalación en el listado del
        medicamento.
      </p>
      {fallidas > 0 && (
        <p className={estilos.avisoNota}>
          De {numero(capturas.length)} capturas analizadas para este
          medicamento, {numero(fallidas)} fallaron.
          {sinDatoUltima
            ? " La captura más reciente es una de ellas: las cantidades de la tabla corresponden a la última captura con dato, indicada en cada fila."
            : ""}
        </p>
      )}
    </section>
  );
}

export function TablaInstalaciones({
  titulo,
  descripcion,
  instalaciones,
  vacio,
}) {
  const filas = instalaciones.map((instalacion) => ({
    instalacion,
    estado: estadoInstalacion(instalacion),
  }));

  return (
    <section className={estilos.seccion}>
      <div className={estilos.tituloFila}>
        <h2 className={estilos.h2Bloque}>{titulo}</h2>
        <span className={`${estilos.conteo} num`}>
          {numero(instalaciones.length)}
        </span>
      </div>
      <p className={estilos.parrafo}>{descripcion}</p>

      {filas.length === 0 ? (
        <p className={estilos.vacio}>{vacio}</p>
      ) : (
        <div className={estilos.tablaEnvoltura}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Instalación</th>
                <th scope="col">Provincia</th>
                <th scope="col" className={estilos.derecha}>
                  Cantidad actual
                </th>
                <th scope="col" className={estilos.derecha}>
                  Días de abastecimiento
                </th>
                <th scope="col">Confiabilidad</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ instalacion, estado }) => (
                <tr key={instalacion.nombre}>
                  <td>
                    <span className={estilos.nombreInstalacion}>
                      {instalacion.nombre}
                    </span>
                    {instalacion.etiquetas?.length > 0 && (
                      <span className={estilos.etiquetas}>
                        {instalacion.etiquetas.join(" · ")}
                      </span>
                    )}
                    {estado.ultimoOk?.avisos?.length > 0 && (
                      <ul className={estilos.avisos}>
                        {estado.ultimoOk.avisos.map((aviso) => (
                          <li key={aviso}>{aviso}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <span>{instalacion.provincia ?? "—"}</span>
                    {instalacion.corregimiento && (
                      <span className={estilos.corregimiento}>
                        {instalacion.corregimiento}
                      </span>
                    )}
                  </td>
                  <td className={`${estilos.derecha} num`}>
                    <Cantidad estado={estado} instalacion={instalacion} />
                  </td>
                  <td className={`${estilos.derecha} num`}>
                    <Dias estado={estado} />
                  </td>
                  <td>
                    <Confiabilidad instalacion={instalacion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Confiabilidad({ instalacion }) {
  const puntos = Array.isArray(instalacion?.puntos) ? instalacion.puntos : [];
  const lecturasOk = puntos.filter((p) => p?.estado_captura === "ok");
  const lecturas = lecturasOk.length;

  if (lecturas === 0) {
    return <span className={estilos.subCelda}>Sin lecturas suficientes</span>;
  }

  const disponibles = lecturasOk.filter(
    (p) => typeof p?.cantidad === "number" && p.cantidad > 0,
  ).length;
  const proporcion = disponibles / lecturas;

  let etiqueta = "Escaso";
  if (proporcion >= 0.8) etiqueta = "Estable";
  else if (proporcion >= 0.3) etiqueta = "Intermitente";

  return (
    <>
      <span className={`${estilos.confiabilidad} num`}>
        Disponible en {numero(disponibles)} de {numero(lecturas)} lecturas
      </span>
      <span className={estilos.subCelda}>{etiqueta}</span>
    </>
  );
}

function Cantidad({ estado, instalacion }) {
  const { ultimo, conDato, datoAnterior } = estado;

  if (!ultimo) {
    return <span className="marca">sin dato</span>;
  }

  if (conDato) {
    if (typeof ultimo.cantidad !== "number") {
      return (
        <>
          <span className="marca">sin cifra publicada</span>
          {ultimo.cantidad_texto && (
            <span className={estilos.subCelda}>{ultimo.cantidad_texto}</span>
          )}
        </>
      );
    }
    return (
      <>
        <span className={estilos.cantidad}>{numero(ultimo.cantidad)}</span>
        {instalacion.unidad && (
          <span className={estilos.subCelda}>{instalacion.unidad}</span>
        )}
      </>
    );
  }

  const esNoListada = ultimo.estado_captura === "no_listada";

  return (
    <>
      <span className="marca">{esNoListada ? "no listada" : "sin dato"}</span>
      <span className={estilos.subCelda}>
        {esNoListada
          ? "la fuente no la incluyó en esta captura"
          : "la captura falló"}
      </span>
      {datoAnterior && typeof datoAnterior.cantidad === "number" && (
        <span className={estilos.subCelda}>
          último dato: {numero(datoAnterior.cantidad)} en{" "}
          {horaDeCaptura(datoAnterior.captura)}
        </span>
      )}
    </>
  );
}

function Dias({ estado }) {
  const { ultimo, conDato, datoAnterior } = estado;

  if (conDato) {
    const texto = diasTexto(ultimo);
    return texto === "no publicado" ? (
      <span className={estilos.noPublicado}>no publicado</span>
    ) : (
      <span className={estilos.cantidadDias}>{texto}</span>
    );
  }

  const anterior = datoAnterior ? diasTexto(datoAnterior) : null;
  const esNoListada = ultimo?.estado_captura === "no_listada";

  return (
    <>
      <span className="marca">{esNoListada ? "no listada" : "sin dato"}</span>
      {anterior && (
        <span className={estilos.subCelda}>
          {anterior === "no publicado"
            ? "último dato: no publicado"
            : `último dato: ${anterior}`}
        </span>
      )}
    </>
  );
}

export function ListaCambios({ cambios, nota }) {
  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.h2}>Cambios detectados</h2>
      <p className={estilos.parrafo}>
        {cambios.length > 0
          ? `${numero(cambios.length)} ${
              cambios.length === 1
                ? "movimiento detectado"
                : "movimientos detectados"
            } al comparar capturas consecutivas de este medicamento.`
          : "No se detectó ningún cambio de inventario en este medicamento entre las capturas analizadas."}
      </p>
      {nota && <p className={estilos.notaSeccion}>{nota}</p>}

      {cambios.length > 0 && (
        <ol className={estilos.cambios}>
          {cambios.map((c, indice) => (
            <li
              key={`${c.captura_antes}-${c.captura_despues}-${c.instalacion}-${indice}`}
              className={estilos.cambio}
            >
              <div className={estilos.cambioCabecera}>
                <span className="marca">
                  {ETIQUETA_TIPO_CAMBIO[c.tipo] ?? c.tipo}
                </span>
                {c.es_bodega === true && (
                  <span className="marca">bodega</span>
                )}
                <span className={`${estilos.cambioCuando} num`}>
                  {fechaHoraUTC(c.cuando) ?? c.cuando}
                </span>
              </div>
              <p className={estilos.cambioInstalacion}>{c.instalacion}</p>
              <p className={estilos.cambioProvincia}>{c.provincia ?? "—"}</p>
              <p className={`${estilos.cambioCifras} num`}>
                <LadoCantidad
                  valor={c.cantidad_antes}
                  tipo={c.tipo}
                  lado="antes"
                />
                <span className={estilos.flecha}> → </span>
                <LadoCantidad
                  valor={c.cantidad_despues}
                  tipo={c.tipo}
                  lado="despues"
                />
                {c.unidad &&
                typeof c.cantidad_antes === "number" &&
                typeof c.cantidad_despues === "number" ? (
                  <span className={estilos.unidad}> {c.unidad}</span>
                ) : null}
                {typeof c.delta === "number" && (
                  <span className={estilos.delta}>
                    {c.delta > 0 ? `+${numero(c.delta)}` : numero(c.delta)}
                  </span>
                )}
              </p>
              {tieneDiasRegistrados(c) && (
                <p className={estilos.cambioDetalle}>
                  Días de abastecimiento:{" "}
                  <span className="num">{diasDeCambio(c.dias_antes)}</span>
                  <span className={estilos.flecha}> → </span>
                  <span className="num">{diasDeCambio(c.dias_despues)}</span>
                </p>
              )}
              <p className={estilos.cambioDetalle}>
                Entre las capturas{" "}
                <span className="num">{c.captura_antes}</span> y{" "}
                <span className="num">{c.captura_despues}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LadoCantidad({ valor, tipo, lado }) {
  if (typeof valor === "number") return <>{numero(valor)}</>;
  return <span className="marca">{etiquetaCantidadAusente(tipo, lado)}</span>;
}

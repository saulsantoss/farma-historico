"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Cabecera from "../../componentes/Cabecera";
import Pie from "../../componentes/Pie";
import { Cargando, Error as ErrorDatos } from "../../componentes/Estado";
import {
  diasDeCambio,
  diasTexto,
  estadoInstalacion,
  etiquetaCantidadAusente,
  ETIQUETA_TIPO_CAMBIO,
  fechaHoraUTC,
  horaDeCaptura,
  numero,
  obtenerJSON,
  tieneDiasRegistrados,
} from "../../lib/datos";
import estilos from "./pagina.module.css";

export default function VistaMedicamento() {
  const parametros = useParams();
  const id = parametros?.id ? decodeURIComponent(String(parametros.id)) : null;

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let vivo = true;

    (async () => {
      try {
        const [medicamento, cambios] = await Promise.all([
          obtenerJSON(`/medicamentos/${id}.json`),
          obtenerJSON("/cambios.json"),
        ]);
        if (!vivo) return;
        setDatos({ medicamento, cambios });
      } catch (e) {
        if (vivo) setError(e.message);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [id]);

  return (
    <>
      <Cabecera activo="medicamentos" />
      <main className="contenedor">
        <p className={estilos.volver}>
          <Link href="/#medicamentos">Todos los medicamentos</Link>
        </p>

        {error && (
          <>
            <h1 className={estilos.h1}>
              {error.includes("404")
                ? "No hay serie para este identificador"
                : id}
            </h1>
            <ErrorDatos
              mensaje={
                error.includes("404")
                  ? `No existe un medicamento monitoreado con el identificador «${id}».`
                  : error
              }
            />
          </>
        )}
        {!error && !datos && <Cargando que="la serie del medicamento" />}
        {datos && (
          <Contenido
            medicamento={datos.medicamento}
            cambios={datos.cambios}
            id={id}
          />
        )}
      </main>
      <Pie />
    </>
  );
}

function Contenido({ medicamento, cambios, id }) {
  const metricas = medicamento.metricas ?? {};
  const atencion = medicamento.instalaciones_atencion ?? [];
  const bodegas = medicamento.bodegas ?? [];
  const capturas = medicamento.capturas_analizadas ?? [];
  const ultimaCaptura = capturas.length
    ? capturas[capturas.length - 1].captura
    : null;

  const cambiosDelMedicamento = (cambios?.cambios ?? []).filter(
    (c) => c.medicamento_id === id,
  );

  const sinDatoUltima =
    capturas.length && capturas[capturas.length - 1].ok === false;

  return (
    <>
      <header className={estilos.encabezado}>
        <p className="etiquetaCampo">Medicamento</p>
        <h1 className={estilos.h1}>{medicamento.medicamento_nombre}</h1>
        <dl className={estilos.meta}>
          <div>
            <dt className="etiquetaCampo">Identificador</dt>
            <dd className="num">{medicamento.medicamento_id}</dd>
          </div>
          <div>
            <dt className="etiquetaCampo">Término buscado en la fuente</dt>
            <dd>{medicamento.medicamento_termino ?? "—"}</dd>
          </div>
          <div>
            <dt className="etiquetaCampo">Última captura analizada</dt>
            <dd className="num">
              {ultimaCaptura ?? "—"}
              {ultimaCaptura ? ` · ${horaDeCaptura(ultimaCaptura)}` : ""}
            </dd>
          </div>
        </dl>
      </header>

      <section className={estilos.seccionCifras}>
        <div className={estilos.cifras}>
          <Cifra
            valor={numero(metricas.instalaciones_atencion)}
            etiqueta="Instalaciones de atención"
          />
          <Cifra valor={numero(metricas.bodegas)} etiqueta="Bodegas" />
          <Cifra
            valor={numero(metricas.capturas_ok)}
            etiqueta="Capturas con dato"
          />
          <Cifra
            valor={numero(metricas.capturas_fallidas)}
            etiqueta="Capturas sin dato"
          />
        </div>
      </section>

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
        {typeof metricas.capturas_fallidas === "number" &&
          metricas.capturas_fallidas > 0 && (
            <p className={estilos.avisoNota}>
              De {numero(capturas.length)} capturas analizadas para este
              medicamento, {numero(metricas.capturas_fallidas)} fallaron.
              {sinDatoUltima
                ? " La captura más reciente es una de ellas: las cantidades de la tabla corresponden a la última captura con dato, indicada en cada fila."
                : ""}
            </p>
          )}
      </section>

      <TablaInstalaciones
        titulo="Instalaciones de atención"
        descripcion="Policlínicas, hospitales, ULAPS, CAPPS y otras unidades donde se atiende y despacha al paciente."
        instalaciones={atencion}
        vacio="La fuente no listó instalaciones de atención para este medicamento en las capturas analizadas."
      />

      <TablaInstalaciones
        titulo="Bodegas"
        descripcion="Depósitos regionales. No despachan al paciente: sus existencias no son medicamento disponible en ventanilla y no deben sumarse a las de atención."
        instalaciones={bodegas}
        vacio="No se registran bodegas para este medicamento en las capturas analizadas."
      />

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Cambios detectados</h2>
        <p className={estilos.parrafo}>
          {cambiosDelMedicamento.length > 0
            ? `${numero(cambiosDelMedicamento.length)} ${
                cambiosDelMedicamento.length === 1
                  ? "movimiento detectado"
                  : "movimientos detectados"
              } al comparar capturas consecutivas de este medicamento.`
            : "No se detectó ningún cambio de inventario en este medicamento entre las capturas analizadas."}
        </p>
        {cambios?.nota && <p className={estilos.notaSeccion}>{cambios.nota}</p>}

        {cambiosDelMedicamento.length > 0 && (
          <ol className={estilos.cambios}>
            {cambiosDelMedicamento.map((c, indice) => (
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

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Capturas de este medicamento</h2>
        <p className={estilos.parrafo}>
          Las {numero(capturas.length)} capturas analizadas, en orden. Las que
          fallaron se conservan en el registro: ocultarlas haría parecer que la
          serie es continua.
        </p>
        <div className={estilos.tablaEnvoltura}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Captura</th>
                <th scope="col">Hora</th>
                <th scope="col">Resultado</th>
                <th scope="col">Motivo del fallo</th>
              </tr>
            </thead>
            <tbody>
              {capturas.map((c) => (
                <tr key={c.captura}>
                  <td className="num">{c.captura}</td>
                  <td className="num">
                    {fechaHoraUTC(c.capturado_en) ?? horaDeCaptura(c.captura)}
                  </td>
                  <td>
                    {c.ok ? (
                      "con dato"
                    ) : (
                      <span className="marca">sin dato</span>
                    )}
                  </td>
                  <td className={estilos.motivo}>
                    {c.ok ? "—" : primeraLinea(c.error)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className={estilos.generado}>
        Serie generada el {fechaHoraUTC(medicamento.generado_en) ?? "—"} a partir
        de{" "}
        <a href={medicamento.fuente} rel="nofollow noreferrer">
          {medicamento.fuente}
        </a>
        .
      </p>
    </>
  );
}

function TablaInstalaciones({ titulo, descripcion, instalaciones, vacio }) {
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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

function LadoCantidad({ valor, tipo, lado }) {
  if (typeof valor === "number") return <>{numero(valor)}</>;
  return <span className="marca">{etiquetaCantidadAusente(tipo, lado)}</span>;
}

function Cifra({ valor, etiqueta }) {
  return (
    <div className={estilos.cifra}>
      <p className={`${estilos.cifraValor} num`}>{valor ?? "—"}</p>
      <p className={estilos.cifraEtiqueta}>{etiqueta}</p>
    </div>
  );
}

function primeraLinea(texto) {
  if (!texto) return "motivo no registrado";
  return String(texto).split("\n")[0].trim();
}

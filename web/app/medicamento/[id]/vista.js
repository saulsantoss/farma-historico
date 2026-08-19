"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Cabecera from "../../componentes/Cabecera";
import Pie from "../../componentes/Pie";
import { Cargando, Error as ErrorDatos } from "../../componentes/Estado";
import {
  AvisoLectura,
  ListaCambios,
  TablaInstalaciones,
} from "../../componentes/DetalleMedicamento";
import {
  fechaHoraUTC,
  horaDeCaptura,
  numero,
  obtenerJSON,
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
      <Cabecera activo="explorar" />
      <main className="contenedor">
        <p className={estilos.volver}>
          <Link href="/explorar">Explorar el histórico</Link>
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

      <AvisoLectura metricas={metricas} capturas={capturas} />

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

      <ListaCambios
        cambios={cambiosDelMedicamento}
        nota={cambios?.nota}
      />

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

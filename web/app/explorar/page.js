"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cabecera from "../componentes/Cabecera";
import Pie from "../componentes/Pie";
import { Cargando, Error as ErrorDatos } from "../componentes/Estado";
import {
  AvisoLectura,
  ListaCambios,
  TablaInstalaciones,
} from "../componentes/DetalleMedicamento";
import {
  fechaHoraUTC,
  horaDeCaptura,
  numero,
  obtenerJSON,
} from "../lib/datos";
import estilos from "./explorar.module.css";

export default function Explorar() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const [resumen, indice, cambios] = await Promise.all([
          obtenerJSON("/resumen.json"),
          obtenerJSON("/medicamentos/index.json"),
          obtenerJSON("/cambios.json"),
        ]);
        const medicamentos = indice.medicamentos ?? [];
        const detalles = await Promise.all(
          medicamentos.map((m) =>
            obtenerJSON(`/medicamentos/${m.medicamento_id}.json`).catch(
              () => null,
            ),
          ),
        );
        if (!vivo) return;
        setDatos({ resumen, indice, cambios, detalles });
        if (medicamentos.length > 0) {
          setSeleccion(medicamentos[0].medicamento_id);
        }
      } catch (e) {
        if (vivo) setError(e.message);
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return (
    <>
      <Cabecera activo="explorar" />
      <main className="contenedor">
        <header className={estilos.encabezado}>
          <p className="etiquetaCampo">Explorador</p>
          <h1 className={estilos.h1}>Explorar el histórico</h1>
          <div className={estilos.acciones}>
            <button
              type="button"
              className={estilos.boton}
              onClick={() => window.location.reload()}
            >
              Actualizar
            </button>
            {datos && (
              <p className={`${estilos.ultimaActualizacion} num`}>
                Última actualización: {ultimaActualizacion(datos.resumen)}
              </p>
            )}
            <button
              type="button"
              className={estilos.enlaceBoton}
              onClick={() => setAyudaAbierta(true)}
            >
              ¿Cómo se leen estos datos?
            </button>
          </div>
        </header>

        {error && <ErrorDatos mensaje={error} />}
        {!error && !datos && <Cargando que="el explorador" />}
        {datos && (
          <Contenido
            resumen={datos.resumen}
            indice={datos.indice}
            cambios={datos.cambios}
            detalles={datos.detalles}
            seleccion={seleccion}
            onSeleccion={setSeleccion}
          />
        )}
      </main>
      {ayudaAbierta && <Ayuda onCerrar={() => setAyudaAbierta(false)} />}
      <Pie />
    </>
  );
}

function Contenido({
  resumen,
  indice,
  cambios,
  detalles,
  seleccion,
  onSeleccion,
}) {
  const medicamentos = indice.medicamentos ?? [];
  const detallesPorId = new Map();
  medicamentos.forEach((m, i) => {
    if (detalles[i]) detallesPorId.set(m.medicamento_id, detalles[i]);
  });

  const atencion = new Set();
  const bodegas = new Set();
  for (const detalle of detalles) {
    if (!detalle) continue;
    for (const i of detalle.instalaciones_atencion ?? []) atencion.add(i.nombre);
    for (const b of detalle.bodegas ?? []) bodegas.add(b.nombre);
  }
  const completo = detalles.every(Boolean);

  const seleccionado =
    medicamentos.find((m) => m.medicamento_id === seleccion) ??
    medicamentos[0] ??
    null;
  const detalle = seleccionado
    ? detallesPorId.get(seleccionado.medicamento_id)
    : null;
  const cambiosDelMedicamento = (cambios?.cambios ?? []).filter(
    (c) => c.medicamento_id === seleccionado?.medicamento_id,
  );
  const portada = resumen.portada_nacional_ultima ?? null;
  const salud = resumen.salud_capturas ?? [];

  return (
    <>
      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Lo que hay registrado</h2>
        <div className={estilos.cifras}>
          <Cifra
            valor={numero(resumen.total_capturas_analizadas)}
            etiqueta="Capturas analizadas"
          />
          <Cifra
            valor={numero(atencion.size + bodegas.size)}
            etiqueta="Instalaciones monitoreadas"
            apoyo={
              completo
                ? `${numero(atencion.size)} de atención · ${numero(
                    bodegas.size,
                  )} bodegas`
                : "Contando instalaciones distintas…"
            }
          />
          <Cifra
            valor={numero(resumen.cambios_detectados)}
            etiqueta="Cambios detectados"
          />
        </div>
      </section>

      <div className={estilos.cuerpo}>
        <aside className={estilos.lateral}>
          <p className="etiquetaCampo">Medicamentos</p>
          <select
            className={estilos.select}
            value={seleccionado?.medicamento_id ?? ""}
            onChange={(e) => onSeleccion(e.target.value)}
            aria-label="Seleccionar medicamento"
          >
            {medicamentos.map((m) => (
              <option key={m.medicamento_id} value={m.medicamento_id}>
                {m.medicamento_nombre}
              </option>
            ))}
          </select>
          <ul className={estilos.lista}>
            {medicamentos.map((m) => (
              <li key={m.medicamento_id}>
                <button
                  type="button"
                  className={
                    m.medicamento_id === seleccionado?.medicamento_id
                      ? `${estilos.lateralEnlace} ${estilos.lateralEnlaceActivo}`
                      : estilos.lateralEnlace
                  }
                  onClick={() => onSeleccion(m.medicamento_id)}
                >
                  {m.medicamento_nombre}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className={estilos.panel}>
          {seleccionado && detalle ? (
            <>
              <header className={estilos.panelCabecera}>
                <p className="etiquetaCampo">Medicamento</p>
                <h2 className={estilos.panelTitulo}>
                  {detalle.medicamento_nombre}
                </h2>
                <p className={estilos.panelMeta}>
                  <Link href={`/medicamento/${detalle.medicamento_id}`}>
                    Ver la serie completa de este medicamento
                  </Link>
                </p>
              </header>

              <AvisoLectura
                metricas={detalle.metricas ?? {}}
                capturas={detalle.capturas_analizadas ?? []}
              />

              <TablaInstalaciones
                titulo="Instalaciones de atención"
                descripcion="Policlínicas, hospitales, ULAPS, CAPPS y otras unidades donde se atiende y despacha al paciente."
                instalaciones={detalle.instalaciones_atencion ?? []}
                vacio="La fuente no listó instalaciones de atención para este medicamento en las capturas analizadas."
              />

              <TablaInstalaciones
                titulo="Bodegas"
                descripcion="Depósitos regionales. No despachan al paciente: sus existencias no son medicamento disponible en ventanilla y no deben sumarse a las de atención."
                instalaciones={detalle.bodegas ?? []}
                vacio="No se registran bodegas para este medicamento en las capturas analizadas."
              />

              <ListaCambios
                cambios={cambiosDelMedicamento}
                nota={cambios?.nota}
              />
            </>
          ) : (
            <p className={estilos.panelVacio}>
              Selecciona un medicamento para ver su serie.
            </p>
          )}
        </div>
      </div>

      {salud.length > 0 && (
        <section className={estilos.seccion}>
          <h2 className={estilos.h2}>Estado de cada captura</h2>
          <p className={estilos.parrafo}>
            Cada captura recorre los {numero(resumen.total_medicamentos)}{" "}
            medicamentos uno por uno. Cuando la fuente no responde, el
            medicamento queda sin dato para esa hora.
          </p>
          <div className={estilos.tablaEnvoltura}>
            <table className={estilos.tabla}>
              <thead>
                <tr>
                  <th scope="col">Captura</th>
                  <th scope="col">Hora</th>
                  <th scope="col" className={estilos.derecha}>
                    Medicamentos con dato
                  </th>
                  <th scope="col" className={estilos.derecha}>
                    Sin dato
                  </th>
                </tr>
              </thead>
              <tbody>
                {salud.map((fila) => (
                  <tr key={fila.captura}>
                    <td className="num">{fila.captura}</td>
                    <td className="num">{horaDeCaptura(fila.captura)}</td>
                    <td className={`${estilos.derecha} num`}>
                      {numero(fila.medicamentos_ok) ?? "—"}
                    </td>
                    <td className={`${estilos.derecha} num`}>
                      {fila.medicamentos_fallidos > 0 ? (
                        <span className="marca">
                          {numero(fila.medicamentos_fallidos)} sin dato
                        </span>
                      ) : (
                        <span className={estilos.cero}>0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {portada && (
        <section className={estilos.seccion}>
          <h2 className={estilos.h2}>Portada nacional</h2>
          <p className={estilos.parrafo}>
            Cifras que el propio sitio muestra en su portada, tal como estaban
            en la captura <span className="num">{portada.captura ?? "—"}</span>
            {portada.capturado_en
              ? ` (${fechaHoraUTC(portada.capturado_en)})`
              : ""}
            .
          </p>
          <div className={estilos.portada}>
            <div className={estilos.portadaBloque}>
              <p className={`${estilos.portadaNumero} num`}>
                {numero(portada.disponibles_n) ?? "—"}
                <span className={estilos.portadaDe}>
                  {" "}
                  de {numero(portada.lom_total) ?? "—"}
                </span>
              </p>
              <p className="etiquetaCampo">
                Medicamentos disponibles de la Lista Oficial
              </p>
            </div>
            <div className={estilos.portadaBloque}>
              <p className={`${estilos.portadaNumero} num`}>
                {numero(portada.disponibles_pct) ?? "—"}
                <span className={estilos.portadaDe}> %</span>
              </p>
              <p className="etiquetaCampo">Disponibilidad reportada</p>
            </div>
            <div className={estilos.portadaBloque}>
              <p className={`${estilos.portadaNumero} num`}>
                {numero(portada.dias_abastecimiento_nacional) ?? "—"}
              </p>
              <p className="etiquetaCampo">
                Días de abastecimiento nacional
              </p>
            </div>
          </div>
          <p className={estilos.notaSeccion}>
            En las {numero(resumen.total_capturas_analizadas)} capturas
            analizadas no quedó registrada la serie histórica de estos tres
            valores: en <span className="num">portada_nacional_serie</span>{" "}
            todos los campos están vacíos. Solo se conserva el último dato, y por
            eso no se muestra evolución.
          </p>
        </section>
      )}
    </>
  );
}

function Cifra({ valor, etiqueta, apoyo }) {
  return (
    <div className={estilos.cifra}>
      <p className={`${estilos.cifraValor} num`}>{valor ?? "—"}</p>
      <p className={estilos.cifraEtiqueta}>{etiqueta}</p>
      {apoyo && <p className={estilos.cifraApoyo}>{apoyo}</p>}
    </div>
  );
}

function ultimaActualizacion(resumen) {
  const generado = fechaHoraUTC(resumen.generado_en);
  if (generado) return generado;
  if (resumen.ultima_captura?.id) return horaDeCaptura(resumen.ultima_captura.id);
  if (resumen.ultima_captura?.hora_utc) {
    return horaDeCaptura(
      `${resumen.ultima_captura.fecha}/${resumen.ultima_captura.hora_utc}`,
    );
  }
  return "—";
}

function Ayuda({ onCerrar }) {
  useEffect(() => {
    const alTecla = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [onCerrar]);

  return (
    <div className={estilos.modalFondo} onClick={onCerrar}>
      <div
        className={estilos.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayuda-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ayuda-titulo" className={estilos.modalTitulo}>
          ¿Cómo se leen estos datos?
        </h2>
        <p className={estilos.modalTexto}>
          Una captura fallida se muestra siempre como{" "}
          <span className="marca">sin dato</span>: no es un cero ni
          desabastecimiento, y no se cuenta como ausencia de existencias. Una
          instalación que la fuente dejó de listar se marca{" "}
          <span className="marca">no listada</span>, distinto de un fallo. Las
          bodegas van siempre aparte porque sus existencias no se despachan en
          ventanilla.
        </p>
        <p className={estilos.modalTexto}>
          <Link href="/metodologia">Metodología y datos descartados</Link>
        </p>
        <button type="button" className={estilos.boton} onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cabecera from "./componentes/Cabecera";
import Pie from "./componentes/Pie";
import { Cargando, Error as ErrorDatos } from "./componentes/Estado";
import {
  fechaHoraUTC,
  fechaLarga,
  horaDeCaptura,
  horaPanama,
  horaUTC,
  isoDesdePrimeraCaptura,
  numero,
  obtenerJSON,
} from "./lib/datos";
import estilos from "./page.module.css";

export default function Inicio() {
  const [datos, setDatos] = useState(null);
  const [cobertura, setCobertura] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const [resumen, indice] = await Promise.all([
          obtenerJSON("/resumen.json"),
          obtenerJSON("/medicamentos/index.json"),
        ]);
        if (!vivo) return;
        setDatos({ resumen, indice });

        // Las instalaciones distintas no vienen precalculadas: se cuentan
        // uniendo los nombres de las series de cada medicamento.
        const detalles = await Promise.all(
          (indice.medicamentos ?? []).map((m) =>
            obtenerJSON(`/medicamentos/${m.medicamento_id}.json`).catch(
              () => null,
            ),
          ),
        );
        if (!vivo) return;

        const atencion = new Set();
        const bodegas = new Set();
        for (const detalle of detalles) {
          if (!detalle) continue;
          for (const i of detalle.instalaciones_atencion ?? [])
            atencion.add(i.nombre);
          for (const b of detalle.bodegas ?? []) bodegas.add(b.nombre);
        }
        setCobertura({
          atencion: atencion.size,
          bodegas: bodegas.size,
          completo: detalles.every(Boolean),
        });
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
      <Cabecera activo="inicio" />
      <main className="contenedor">
        <section className={estilos.intro}>
          <h1 className={estilos.h1}>
            El histórico que la CSS no conserva
          </h1>
          <p className={estilos.entrada}>
            Mi Farma Digital publica cuántas unidades de cada medicamento hay en
            cada instalación de la Caja de Seguro Social, pero solo muestra el
            estado de ahora: cuando el dato cambia, el anterior desaparece.
          </p>
          <p className={estilos.entradaSecundaria}>
            Este sitio captura ese inventario público de forma automatizada y
            guarda cada captura. Lo que se ve aquí es la serie en el tiempo:
            cuánto había en cada instalación, cuándo cambió, y qué capturas
            fallaron. Un fallo de captura se muestra siempre como{" "}
            <span className="marca">sin dato</span>, nunca como cero.
          </p>
        </section>

        {error && <ErrorDatos mensaje={error} />}
        {!error && !datos && <Cargando que="el resumen" />}

        {datos && (
          <Contenido
            resumen={datos.resumen}
            indice={datos.indice}
            cobertura={cobertura}
          />
        )}
      </main>
      <Pie />
    </>
  );
}

function Contenido({ resumen, indice, cobertura }) {
  const isoPrimera = isoDesdePrimeraCaptura(resumen.primera_captura);
  const portada = resumen.portada_nacional_ultima ?? null;
  const exclusiones = resumen.exclusiones ?? null;
  const salud = resumen.salud_capturas ?? [];
  const medicamentos = indice.medicamentos ?? [];

  return (
    <>
      <section className={estilos.hito}>
        <p className="etiquetaCampo">Primera captura conservada</p>
        <p className={`${estilos.hitoFecha} num`}>
          {fechaLarga(isoPrimera) ?? resumen.primera_captura?.fecha ?? "—"}
        </p>
        <p className={`${estilos.hitoHora} num`}>
          {horaUTC(isoPrimera) ?? resumen.primera_captura?.hora_utc ?? "—"} UTC
          <span className={estilos.hitoHoraLocal}>
            {horaPanama(isoPrimera)
              ? ` · ${horaPanama(isoPrimera)} hora de Panamá`
              : ""}
          </span>
        </p>
        <p className={estilos.hitoNota}>
          Desde este instante existe registro continuo. Todo lo anterior a esta
          fecha y hora no se puede reconstruir: la fuente no lo guarda y nadie
          lo capturó.
        </p>
        <dl className={estilos.hitoMeta}>
          <div>
            <dt className="etiquetaCampo">Identificador</dt>
            <dd className="num">{resumen.primera_captura?.id ?? "—"}</dd>
          </div>
          <div>
            <dt className="etiquetaCampo">Última captura analizada</dt>
            <dd className="num">
              {resumen.ultima_captura?.id ?? "—"}
              {resumen.ultima_captura?.id
                ? ` · ${horaDeCaptura(resumen.ultima_captura.id)}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="etiquetaCampo">Resumen generado</dt>
            <dd className="num">{fechaHoraUTC(resumen.generado_en) ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Lo que hay registrado</h2>
        <div className={estilos.cifras}>
          <Cifra
            valor={numero(resumen.total_capturas_analizadas)}
            etiqueta="Capturas analizadas"
            apoyo={
              typeof resumen.total_capturas_en_disco === "number"
                ? `${numero(resumen.total_capturas_en_disco)} registradas en disco · ${numero(
                    exclusiones?.total_excluidas ?? 0,
                  )} excluidas`
                : null
            }
          />
          <Cifra
            valor={numero(resumen.total_medicamentos)}
            etiqueta="Medicamentos monitoreados"
            apoyo="Seleccionados de la Lista Oficial de Medicamentos"
          />
          <Cifra
            valor={
              cobertura
                ? numero(cobertura.atencion + cobertura.bodegas)
                : null
            }
            etiqueta="Instalaciones monitoreadas"
            apoyo={
              cobertura
                ? `${numero(cobertura.atencion)} de atención · ${numero(
                    cobertura.bodegas,
                  )} bodegas${cobertura.completo ? "" : " (conteo parcial)"}`
                : "Contando instalaciones distintas…"
            }
          />
          <Cifra
            valor={numero(resumen.cambios_detectados)}
            etiqueta="Cambios detectados"
            apoyo="Movimientos de inventario entre capturas exitosas"
          />
        </div>
      </section>

      {portada && (
        <section className={estilos.seccion}>
          <h2 className={estilos.h2}>Portada nacional</h2>
          <p className={estilos.parrafo}>
            Cifras que el propio sitio muestra en su portada, tal como estaban
            en la captura{" "}
            <span className="num">{portada.captura ?? "—"}</span>
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
            valores: en{" "}
            <span className="num">portada_nacional_serie</span> todos los campos
            están vacíos. Solo se conserva el último dato, y por eso no se
            muestra evolución.
          </p>
        </section>
      )}

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

      <section className={estilos.seccion} id="medicamentos">
        <h2 className={estilos.h2}>Medicamentos</h2>
        <p className={estilos.parrafo}>
          {numero(medicamentos.length)} medicamentos con serie propia. Cada uno
          tiene su tabla de instalaciones de atención, sus bodegas por separado
          y la lista de cambios detectados.
        </p>
        <div className={estilos.tablaEnvoltura}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Medicamento</th>
                <th scope="col" className={estilos.derecha}>
                  Instalaciones de atención
                </th>
                <th scope="col" className={estilos.derecha}>
                  Bodegas
                </th>
                <th scope="col" className={estilos.derecha}>
                  Capturas sin dato
                </th>
                <th scope="col" className={estilos.derecha}>
                  Sin días publicados
                </th>
              </tr>
            </thead>
            <tbody>
              {medicamentos.map((m) => (
                <tr key={m.medicamento_id}>
                  <td>
                    <Link
                      href={`/medicamento/${m.medicamento_id}`}
                      className={estilos.enlaceMedicamento}
                    >
                      {m.medicamento_nombre}
                    </Link>
                  </td>
                  <td className={`${estilos.derecha} num`}>
                    {numero(m.instalaciones_atencion) ?? "—"}
                  </td>
                  <td className={`${estilos.derecha} num`}>
                    {numero(m.bodegas) ?? "—"}
                  </td>
                  <td className={`${estilos.derecha} num`}>
                    {numero(m.capturas_fallidas) ?? "—"}
                  </td>
                  <td className={`${estilos.derecha} num`}>
                    {numero(m.sin_dias_publicados) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Cómo leer estos datos</h2>
        <p className={estilos.parrafo}>
          De las {numero(resumen.total_capturas_en_disco)} capturas registradas,{" "}
          {numero(resumen.total_capturas_analizadas)} se usan para el análisis.
          Las {numero(exclusiones?.total_excluidas ?? 0)} descartadas, sus
          motivos, y todo lo que estos datos no permiten saber están detallados
          en la metodología.
        </p>
        <p className={estilos.enlaceGrande}>
          <Link href="/metodologia">Metodología y datos descartados</Link>
        </p>
      </section>
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

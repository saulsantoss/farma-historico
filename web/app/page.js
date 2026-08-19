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
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const r = await obtenerJSON("/resumen.json");
        if (!vivo) return;
        setResumen(r);
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
        {!error && !resumen && <Cargando que="el resumen" />}

        {resumen && (
          <>
            <section className={estilos.hito}>
              <p className="etiquetaCampo">Primera captura conservada</p>
              <p className={`${estilos.hitoFecha} num`}>
                {fechaLarga(isoDesdePrimeraCaptura(resumen.primera_captura)) ??
                  resumen.primera_captura?.fecha ??
                  "—"}
              </p>
              <p className={`${estilos.hitoHora} num`}>
                {horaUTC(isoDesdePrimeraCaptura(resumen.primera_captura)) ??
                  resumen.primera_captura?.hora_utc ??
                  "—"}{" "}
                UTC
                <span className={estilos.hitoHoraLocal}>
                  {horaPanama(isoDesdePrimeraCaptura(resumen.primera_captura))
                    ? ` · ${horaPanama(
                        isoDesdePrimeraCaptura(resumen.primera_captura),
                      )} hora de Panamá`
                    : ""}
                </span>
              </p>
              <p className={estilos.hitoNota}>
                Desde este instante existe registro continuo. Todo lo anterior a
                esta fecha y hora no se puede reconstruir: la fuente no lo guarda
                y nadie lo capturó.
              </p>
              <dl className={estilos.hitoMeta}>
                <div>
                  <dt className="etiquetaCampo">Identificador</dt>
                  <dd className="num">
                    {resumen.primera_captura?.id ?? "—"}
                  </dd>
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
                  <dd className="num">
                    {fechaHoraUTC(resumen.generado_en) ?? "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={estilos.seccion}>
              <h2 className={estilos.h2}>Qué se puede saber y qué no</h2>
              <div className={estilos.saberes}>
                <div className={estilos.saber}>
                  <p className="etiquetaCampo">Se puede saber</p>
                  <p className={estilos.saberTexto}>
                    En cada captura se conserva cuántas unidades de cada
                    medicamento publica la fuente en cada instalación, si la
                    lectura fue exitosa o falló, y qué valores cambiaron entre
                    capturas consecutivas. Hoy se siguen{" "}
                    <span className="num">
                      {numero(resumen.total_medicamentos)}
                    </span>{" "}
                    medicamentos de la Lista Oficial, con registro continuo
                    desde la primera captura conservada.
                  </p>
                </div>
                <div className={estilos.saber}>
                  <p className="etiquetaCampo">No se puede saber</p>
                  <p className={estilos.saberTexto}>
                    Nada anterior a esa primera captura. Tampoco qué pasó durante
                    una captura fallida: un{" "}
                    <span className="marca">sin dato</span> no es un cero ni
                    desabastecimiento. Y una baja entre dos capturas es la
                    diferencia neta de dos fotos, no un registro de despachos.
                  </p>
                </div>
              </div>
            </section>

            <section className={estilos.seccion}>
              <h2 className={estilos.h2}>Cómo explorar estos datos</h2>
              <p className={estilos.parrafo}>
                El histórico completo, medicamento por medicamento, está en el
                explorador. Los criterios con que se procesó cada captura, las
                que se descartaron y por qué, están en la metodología.
              </p>
              <p className={estilos.enlaceGrande}>
                <Link href="/explorar">Explorar el histórico</Link>
              </p>
              <p className={estilos.enlaceGrande}>
                <Link href="/metodologia">Metodología y datos descartados</Link>
              </p>
            </section>
          </>
        )}
      </main>
      <Pie />
    </>
  );
}

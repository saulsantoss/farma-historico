"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cabecera from "../componentes/Cabecera";
import Pie from "../componentes/Pie";
import { Cargando, Error as ErrorDatos } from "../componentes/Estado";
import {
  fechaHoraUTC,
  horaDeCaptura,
  isoDesdePrimeraCaptura,
  numero,
  obtenerJSON,
} from "../lib/datos";
import estilos from "./pagina.module.css";

export default function Metodologia() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const [resumen, indice, cambios] = await Promise.all([
          obtenerJSON("/resumen.json"),
          obtenerJSON("/medicamentos/index.json"),
          obtenerJSON("/cambios.json"),
        ]);
        if (!vivo) return;
        setDatos({ resumen, indice, cambios });
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
      <Cabecera activo="metodologia" />
      <main className="contenedor">
        <header className={estilos.encabezado}>
          <p className="etiquetaCampo">Metodología</p>
          <h1 className={estilos.h1}>Cómo se hace y qué no se puede saber</h1>
          <p className={estilos.entrada}>
            Todo lo que se muestra sale de capturas automatizadas del inventario
            público de Mi Farma Digital. Esta página describe qué se captura, con
            qué frecuencia, cómo se procesa, qué preguntas estos datos no pueden
            responder, y qué capturas se descartaron y por qué.
          </p>
        </header>

        {error && <ErrorDatos mensaje={error} />}
        {!error && !datos && <Cargando que="la metodología" />}
        {datos && (
          <Contenido
            resumen={datos.resumen}
            indice={datos.indice}
            cambios={datos.cambios}
          />
        )}
      </main>
      <Pie />
    </>
  );
}

function Contenido({ resumen, indice, cambios }) {
  const exclusiones = resumen.exclusiones ?? null;
  const medicamentos = indice.medicamentos ?? [];
  const isoPrimera = isoDesdePrimeraCaptura(resumen.primera_captura);

  return (
    <>
      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Qué se captura</h2>
        <p className={estilos.parrafo}>
          Un navegador automatizado abre el buscador público de Mi Farma Digital,
          escribe el nombre de cada medicamento monitoreado, abre su detalle y
          guarda el texto completo de la página. Ese texto crudo se conserva; de
          él se extraen los campos que se muestran en este sitio.
        </p>
        <ul className={estilos.lista}>
          <li>
            <span className={estilos.listaTitulo}>Por instalación</span>
            nombre, si es bodega o unidad de atención, provincia, corregimiento,
            etiquetas del tipo de instalación, cantidad, unidad de medida
            (pastillas, viales, inhaladores), días de abastecimiento y los avisos
            que publica el propio sitio.
          </li>
          <li>
            <span className={estilos.listaTitulo}>De la portada</span>
            total de la Lista Oficial de Medicamentos, cuántos figuran
            disponibles, el porcentaje y los días de abastecimiento nacional.
          </li>
          <li>
            <span className={estilos.listaTitulo}>De cada captura</span>
            fecha y hora en UTC, si el medicamento se pudo leer, y el error
            exacto cuando falló.
          </li>
        </ul>
        <p className={estilos.parrafoConEspacio}>
          Los {numero(medicamentos.length)} medicamentos monitoreados:
        </p>
        <ul className={estilos.listaMedicamentos}>
          {medicamentos.map((m) => (
            <li key={m.medicamento_id}>
              <Link href={`/medicamento/${m.medicamento_id}`}>
                {m.medicamento_nombre}
              </Link>
            </li>
          ))}
        </ul>
        <p className={estilos.fuenteLinea}>
          Fuente:{" "}
          <a href={resumen.fuente} rel="nofollow noreferrer">
            {resumen.fuente}
          </a>
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Cada cuánto</h2>
        <p className={estilos.parrafo}>
          La captura está programada para ejecutarse automáticamente cada tres
          horas, y además se puede lanzar a mano. En la fase inicial del proyecto
          se lanzaron varias capturas manuales seguidas, por eso los intervalos
          que se ven en el registro son más cortos y desiguales que el
          programado.
        </p>
        <p className={estilos.parrafo}>
          La primera captura conservada es del{" "}
          <span className="num">{resumen.primera_captura?.id ?? "—"}</span>
          {fechaHoraUTC(isoPrimera) ? ` (${fechaHoraUTC(isoPrimera)})` : ""}. Ese
          es el inicio absoluto de la serie: no existe forma de recuperar el
          inventario de antes, porque la fuente solo publica el estado presente.
        </p>
        <p className={estilos.parrafo}>
          Todas las horas de este sitio se muestran en UTC, la misma referencia
          con la que se guardan las capturas. Panamá está cinco horas por detrás
          de UTC.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Cómo se procesa</h2>
        <ul className={estilos.lista}>
          <li>
            <span className={estilos.listaTitulo}>Series por instalación</span>
            cada instalación tiene un punto por captura analizada. Cada punto
            lleva un estado explícito.
          </li>
          <li>
            <span className={estilos.listaTitulo}>Estado «capturado»</span>
            la lectura fue exitosa y la instalación aparecía en el listado. La
            cantidad es la que publicaba el sitio en ese momento.
          </li>
          <li>
            <span className={estilos.listaTitulo}>Estado «sin dato»</span>
            la captura de ese medicamento falló. No hay información para esa
            hora. No es cero, no es desabastecimiento, y nunca se cuenta como
            ausencia de existencias.
          </li>
          <li>
            <span className={estilos.listaTitulo}>Estado «no listada»</span>
            la captura fue exitosa pero el sitio no incluyó esa instalación en el
            listado del medicamento. Es distinto de un fallo y también distinto
            de un cero confirmado.
          </li>
          <li>
            <span className={estilos.listaTitulo}>Bodegas aparte</span>
            las bodegas regionales se muestran siempre en una tabla separada.
            Sus existencias no están disponibles en ventanilla y sumarlas a las
            de atención infla la disponibilidad real.
          </li>
        </ul>
        <p className={estilos.parrafoConEspacio}>
          Un cambio de inventario solo se registra al comparar dos capturas
          consecutivas, ambas incluidas y ambas exitosas, del mismo medicamento.
          {cambios?.nota ? ` ${cambios.nota}` : ""}
        </p>
        <div className={estilos.cifrasProceso}>
          <Cifra
            valor={numero(cambios?.pares_comparados)}
            etiqueta="Pares de capturas comparados"
          />
          <Cifra
            valor={numero(cambios?.pares_saltados_por_fallo)}
            etiqueta="Pares no comparables por fallo de captura"
          />
          <Cifra
            valor={numero(cambios?.total)}
            etiqueta="Cambios detectados"
          />
        </div>
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.h2}>Qué no se puede saber</h2>
        <ul className={estilos.listaLimites}>
          <li>
            <span className={estilos.listaTitulo}>
              Qué había antes de la primera captura
            </span>
            nada. La fuente no conserva histórico y no existe respaldo anterior a{" "}
            <span className="num">{resumen.primera_captura?.id ?? "—"}</span>.
          </li>
          <li>
            <span className={estilos.listaTitulo}>
              Qué pasó durante una captura fallida
            </span>
            nada. Entre dos capturas exitosas el inventario pudo subir, bajar y
            volver a su valor: solo se ven los extremos.
          </li>
          <li>
            <span className={estilos.listaTitulo}>
              Cuánto se despachó a pacientes
            </span>
            no se sabe. Una baja entre capturas es la diferencia neta de dos
            fotos, no un registro de despachos: puede incluir traslados, ajustes
            de inventario o correcciones de registro.
          </li>
          <li>
            <span className={estilos.listaTitulo}>
              Si el dato de la fuente es correcto
            </span>
            no se verifica. Este sitio reproduce lo que la CSS publica; si el
            sistema institucional reporta mal, aquí se conserva ese error tal
            como se publicó.
          </li>
          <li>
            <span className={estilos.listaTitulo}>
              Por qué una instalación deja de aparecer
            </span>
            no se puede distinguir. Cuando una instalación desaparece del listado
            no se sabe si dejó de tener existencias, si dejó de publicarse o si
            cambió de nombre; se marca «no listada», no cero.
          </li>
          <li>
            <span className={estilos.listaTitulo}>
              Cuántos días de abastecimiento hay donde no se publican
            </span>
            no se sabe. Cuando el sitio no publica los días, aquí figura «no
            publicado»: no se estima ni se calcula a partir de la cantidad.
          </li>
          <li>
            <span className={estilos.listaTitulo}>
              El inventario de medicamentos no monitoreados
            </span>
            fuera de alcance. Se siguen {numero(medicamentos.length)} de los{" "}
            {numero(resumen.portada_nacional_ultima?.lom_total) ?? "—"}{" "}
            medicamentos de la Lista Oficial.
          </li>
        </ul>
      </section>

      {exclusiones && (
        <section className={estilos.descartados} id="descartados">
          <div className={estilos.descartadosCabecera}>
            <p className={estilos.descartadosEtiqueta}>Datos descartados</p>
            <h2 className={estilos.h2Descartados}>
              Capturas que existen pero no se usan
            </h2>
          </div>

          {exclusiones.texto_para_pantalla && (
            <p className={estilos.descartadosTexto}>
              {exclusiones.texto_para_pantalla}
            </p>
          )}

          <div className={estilos.cifrasDescartadas}>
            <Cifra
              valor={numero(resumen.total_capturas_en_disco)}
              etiqueta="Capturas registradas en disco"
            />
            <Cifra
              valor={numero(resumen.total_capturas_analizadas)}
              etiqueta="Capturas usadas para el análisis"
            />
            <Cifra
              valor={numero(exclusiones.total_excluidas)}
              etiqueta="Capturas excluidas"
            />
            <Cifra
              valor={exclusiones.piso_captura ?? "—"}
              etiqueta="Primera captura aceptada"
              pequeno
            />
          </div>

          {exclusiones.por_motivo &&
            Object.keys(exclusiones.por_motivo).length > 0 && (
              <div className={estilos.subBloque}>
                <h3 className={estilos.h3}>Motivos</h3>
                <dl className={estilos.motivos}>
                  {Object.entries(exclusiones.por_motivo).map(
                    ([motivo, cuantas]) => (
                      <div key={motivo} className={estilos.motivo}>
                        <dt className={estilos.motivoNombre}>
                          <span className={`${estilos.motivoConteo} num`}>
                            {numero(cuantas)}
                          </span>
                          <span className={estilos.motivoClave}>{motivo}</span>
                          <span className={estilos.motivoUnidad}>
                            {cuantas === 1 ? "captura" : "capturas"}
                          </span>
                        </dt>
                        <dd className={estilos.motivoTexto}>
                          {exclusiones.glosario_motivos?.[motivo] ??
                            "Sin descripción registrada para este motivo."}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
                <p className={estilos.notaMotivos}>
                  Una misma captura puede acumular más de un motivo, por eso la
                  suma de los motivos puede superar el total de capturas
                  excluidas.
                </p>
              </div>
            )}

          {Array.isArray(exclusiones.detalle) &&
            exclusiones.detalle.length > 0 && (
              <div className={estilos.subBloque}>
                <h3 className={estilos.h3}>Captura por captura</h3>
                <ol className={estilos.detalle}>
                  {exclusiones.detalle.map((item) => (
                    <li key={item.captura} className={estilos.detalleItem}>
                      <div className={estilos.detalleCabecera}>
                        <span className={`${estilos.detalleCaptura} num`}>
                          {item.captura}
                        </span>
                        <span className={estilos.detalleHora}>
                          {horaDeCaptura(item.captura)}
                        </span>
                      </div>
                      <div className={estilos.detalleMarcas}>
                        {(item.motivos ?? []).map((motivo) => (
                          <span key={motivo} className="marca">
                            {motivo}
                          </span>
                        ))}
                      </div>
                      <p className={estilos.detalleExplicacion}>
                        {item.explicacion ?? "Sin explicación registrada."}
                      </p>
                      {Array.isArray(item.medicamentos_duplicados) &&
                        item.medicamentos_duplicados.length > 0 && (
                          <ul className={estilos.duplicados}>
                            {item.medicamentos_duplicados.map((par, i) => (
                              <li key={`${item.captura}-dup-${i}`}>
                                Texto idéntico entre{" "}
                                <span className="num">
                                  {Array.isArray(par) ? par.join(" y ") : par}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

          <p className={estilos.descartadosCierre}>
            Ninguna captura se borra. El texto crudo de las capturas excluidas se
            conserva completo, y por eso se puede decir exactamente cuántas hay,
            cuáles son y por qué no se usan. Excluir una captura sin dejar
            constancia sería indistinguible de no haberla hecho nunca.
          </p>
        </section>
      )}

      <p className={estilos.generado}>
        Resumen generado el {fechaHoraUTC(resumen.generado_en) ?? "—"} · modo{" "}
        <span className="num">{resumen.modo ?? "—"}</span>
      </p>
    </>
  );
}

function Cifra({ valor, etiqueta, pequeno }) {
  return (
    <div className={estilos.cifra}>
      <p
        className={`${pequeno ? estilos.cifraValorPequeno : estilos.cifraValor} num`}
      >
        {valor ?? "—"}
      </p>
      <p className={estilos.cifraEtiqueta}>{etiqueta}</p>
    </div>
  );
}

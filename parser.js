const ES_AVISO = /^(Existencia|Farmacia disponible|Considere)/i;
const FIN_CABECERA = /^(Indicaciones:|Restricciones de uso:|Recuerde que no todos)/i;
const RUIDO = /^(¿|Medicamento\s|Nombres? comercial|Se suministra en:|Volver a los resultados|Ver lista oficial|Cómo se calcula|Menú principal|Filtrar por|Limpiar|Buscar)/i;

export function parseDias(linea) {
  if (!linea) return { dias: null, texto: null };
  const texto = linea.replace(/^D[ií]as de abastecimiento:\s*/i, "").trim();
  if (/menos de 1 d/i.test(texto)) return { dias: 0, texto };
  const m = texto.match(/([\d.,]+)\s*d[ií]a/i);
  return { dias: m ? Number(m[1].replace(/,/g, "")) : null, texto };
}

export function parseCantidad(linea) {
  const t = linea.replace(/^Cantidad en inventario:\s*/i, "").trim();
  const m = t.match(/^([\d.,]+)\s+(.*)$/);
  if (!m) return { cantidad: null, unidad: null, texto: t };
  return { cantidad: Number(m[1].replace(/,/g, "")), unidad: m[2].trim(), texto: t };
}

export function parsePortada(texto) {
  const l = texto.split("\n").map((x) => x.trim()).filter(Boolean);
  const out = {
    lom_total: null,
    disponibles_pct: null,
    disponibles_n: null,
    dias_abastecimiento_nacional: null,
  };

  const exist = l.find((x) => /en existencia de/i.test(x));
  if (exist) {
    const m = exist.match(/([\d.,]+)\s+en existencia de\s+([\d.,]+)/i);
    if (m) {
      out.disponibles_n = Number(m[1].replace(/,/g, ""));
      out.lom_total = Number(m[2].replace(/,/g, ""));
    }
  }

  const pct = l.find((x) => /^\d+([.,]\d+)?%$/.test(x));
  if (pct) out.disponibles_pct = Number(pct.replace("%", "").replace(",", "."));

  const iAbast = l.findIndex((x) => /^de abastecimiento$/i.test(x));
  if (iAbast > 0) out.dias_abastecimiento_nacional = parseDias(l[iAbast - 1]).dias;

  return out;
}

export function parseDetalle(texto) {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);

  const idxCantidad = [];
  for (let i = 0; i < lineas.length; i++) {
    if (/^Cantidad en inventario:/i.test(lineas[i])) idxCantidad.push(i);
  }

  if (idxCantidad.length === 0) {
    return { estado: null, instalaciones: [], total_instalaciones: 0, cabecera_ok: false };
  }

  let inicioInstalaciones = 0;
  for (let i = 0; i < idxCantidad[0]; i++) {
    if (FIN_CABECERA.test(lineas[i])) inicioInstalaciones = i + 1;
  }
  const cabeceraDetectada = inicioInstalaciones > 0;
  if (!cabeceraDetectada) inicioInstalaciones = Math.max(0, idxCantidad[0] - 4);

  const cabecera = lineas.slice(0, inicioInstalaciones);
  const estado = cabecera.find((l) => /^Medicamento\s+/i.test(l)) || null;
  const iComerciales = cabecera.findIndex((l) => /^Nombres? comercial/i.test(l));
  const iSuministra = cabecera.findIndex((l) => /^Se suministra en:/i.test(l));

  const instalaciones = [];
  let prevFin = inicioInstalaciones;

  for (const i of idxCantidad) {
    let iDias = null;
    for (let j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
      if (/^D[ií]as de abastecimiento:/i.test(lineas[j])) {
        iDias = j;
        break;
      }
    }

    const brutas = lineas.slice(Math.max(prevFin, i - 8), i);
    const avisos = brutas.filter((l) => ES_AVISO.test(l));
    const utiles = brutas.filter(
      (l) => !ES_AVISO.test(l) && !RUIDO.test(l) && l.length <= 80 && !/:$/.test(l)
    );
    const encabezado = utiles.slice(-4);

    const ubicacion = encabezado.length ? encabezado[encabezado.length - 1] : null;
    const partes = ubicacion ? ubicacion.split(" \u00b7 ").map((s) => s.trim()) : [];

    const nombre = encabezado.length > 1 ? encabezado[0] : null;
    const etiquetas = encabezado.slice(1, -1);
    const esBodega = /bodega/i.test(`${nombre || ""} ${etiquetas.join(" ")}`);

    const cant = parseCantidad(lineas[i]);
    const dias = parseDias(iDias !== null ? lineas[iDias] : null);

    instalaciones.push({
      nombre,
      etiquetas,
      es_bodega: esBodega,
      ubicacion,
      provincia: partes[0] || null,
      corregimiento: partes[1] || null,
      cantidad: cant.cantidad,
      unidad: cant.unidad,
      cantidad_texto: cant.texto,
      dias_abastecimiento: dias.dias,
      dias_abastecimiento_texto: dias.texto,
      dias_no_publicado: dias.dias === null,
      avisos,
      encabezado_lineas: encabezado,
    });

    prevFin = (iDias !== null ? iDias : i) + 1;
  }

  const conDias = instalaciones.filter((x) => !x.dias_no_publicado).length;
  const sinNombre = instalaciones.filter((x) => !x.nombre).length;

  return {
    estado,
    nombres_comerciales:
      iComerciales !== -1 && iSuministra !== -1 ? cabecera.slice(iComerciales + 1, iSuministra) : [],
    se_suministra_en:
      iSuministra !== -1
        ? cabecera[iSuministra]
            .replace(/^Se suministra en:\s*/i, "")
            .split(",")
            .map((s) => s.trim())
        : [],
    instalaciones,
    total_instalaciones: instalaciones.length,
    calidad: {
      cabecera_detectada: cabeceraDetectada,
      con_dias: conDias,
      sin_dias: instalaciones.length - conDias,
      sin_nombre: sinNombre,
      bodegas: instalaciones.filter((x) => x.es_bodega).length,
    },
  };
}

// Acceso a los JSON publicados en /public y formateadores compartidos.
// Ningún campo se inventa: los nombres vienen de resumen.json,
// medicamentos/index.json, medicamentos/<id>.json y cambios.json.

export async function obtenerJSON(ruta) {
  const respuesta = await fetch(ruta, { cache: "no-store" });
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${ruta} (HTTP ${respuesta.status})`);
  }
  return respuesta.json();
}

const ZONA = "America/Panama";

// "2026-08-18/1041Z" -> "2026-08-18T10:41:00Z"
export function isoDesdeCaptura(captura) {
  if (!captura) return null;
  const [fecha, hora] = String(captura).split("/");
  if (!fecha || !hora || hora.length < 4) return null;
  return `${fecha}T${hora.slice(0, 2)}:${hora.slice(2, 4)}:00Z`;
}

export function isoDesdePrimeraCaptura(primera) {
  if (!primera) return null;
  if (primera.fecha && primera.hora_utc) {
    return isoDesdeCaptura(`${primera.fecha}/${primera.hora_utc}`);
  }
  return isoDesdeCaptura(primera.id);
}

export function fechaLarga(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function horaUTC(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

export function horaPanama(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONA,
  }).format(d);
}

export function fechaHoraUTC(iso) {
  const f = fechaLarga(iso);
  const h = horaUTC(iso);
  if (!f) return null;
  return h ? `${f}, ${h} UTC` : f;
}

// "2026-08-18/1041Z" -> "10:41 UTC"
export function horaDeCaptura(captura) {
  const h = horaUTC(isoDesdeCaptura(captura));
  return h ? `${h} UTC` : String(captura ?? "");
}

export function numero(valor) {
  if (typeof valor !== "number" || Number.isNaN(valor)) return null;
  return new Intl.NumberFormat("es-PA").format(valor);
}

// Último punto de la serie y último punto con dato real.
// Un punto "no_capturado" es un fallo de captura, no una ausencia de stock:
// nunca se convierte en cero ni se omite.
export function estadoInstalacion(instalacion) {
  const puntos = Array.isArray(instalacion?.puntos) ? instalacion.puntos : [];
  const ultimo = puntos.length ? puntos[puntos.length - 1] : null;
  let ultimoOk = null;
  for (let i = puntos.length - 1; i >= 0; i -= 1) {
    if (puntos[i]?.estado_captura === "ok") {
      ultimoOk = puntos[i];
      break;
    }
  }
  const conDato = ultimo?.estado_captura === "ok";
  return {
    puntos,
    ultimo,
    ultimoOk,
    conDato,
    // Solo hay dato anterior que mostrar si el último punto no es "ok".
    datoAnterior: !conDato && ultimoOk ? ultimoOk : null,
  };
}

export const ETIQUETA_ESTADO = {
  ok: "capturado",
  no_capturado: "sin dato",
  no_listada: "no listada",
};

export const EXPLICACION_ESTADO = {
  ok: "La captura fue exitosa y el sitio publicó esta instalación.",
  no_capturado:
    "La captura falló: no hay dato para esta hora. No significa que no haya existencias.",
  no_listada:
    "La captura fue exitosa, pero el sitio no incluyó esta instalación en el listado del medicamento.",
};

export function diasTexto(punto) {
  if (!punto || punto.estado_captura !== "ok") return null;
  if (punto.dias_no_publicado === true) return "no publicado";
  if (typeof punto.dias === "number") {
    return `${numero(punto.dias)} ${punto.dias === 1 ? "día" : "días"}`;
  }
  return "no publicado";
}

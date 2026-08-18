#!/usr/bin/env node
/**
 * agregador.js — convierte data/YYYY-MM-DD/HHMMZ/*.json en JSON para la interfaz.
 *
 * Salidas (en public/):
 *   resumen.json              contadores + portada nacional + EXCLUSIONES declaradas
 *   medicamentos/index.json   lista de medicamentos con métricas de cabecera
 *   medicamentos/<id>.json    serie temporal por instalación
 *   cambios.json              movimientos de inventario entre capturas consecutivas
 *
 * Reglas duras:
 *   - PISO: solo se analizan capturas desde PISO_CAPTURA en adelante.
 *     Lo anterior es fase de construcción del pipeline y NO es dato utilizable.
 *   - CONTAMINACIÓN: si dos medicamentos distintos de una misma pasada tienen
 *     texto crudo idéntico (huella md5), esa captura se excluye automáticamente.
 *     Causa conocida: estado de sesión de Blazor no limpiado entre búsquedas.
 *   - ok:false  => NO CAPTURADO. Nunca se convierte en cero ni en ausencia.
 *   - es_bodega => se separa siempre de las instalaciones de atención.
 *   - un cambio solo se emite si AMBAS capturas del par están incluidas y ok:true.
 *
 * Uso:
 *   node agregador.js            análisis normal (solo capturas limpias)
 *   node agregador.js --todo     incluye TODO, también lo sucio. Solo para inspeccionar.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const DATA = 'data';
const RAW = 'raw';
const OUT = 'web/public';

// Piso: primera captura con el pipeline ya estable (limpieza de sesión funcionando).
// Todo lo anterior es fase de construcción.
const PISO_CAPTURA = '2026-08-18/0506Z';

// Un .txt crudo por debajo de este tamaño es una página sin detalle cargado
// (fallo declarado), no un medicamento real. No se usa para comparar huellas.
const MIN_BYTES_DETALLE = 1500;

const INCLUIR_TODO = process.argv.includes('--todo');

// ---------- utilidades ----------

const leerJSON = (ruta) => {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'));
  } catch (e) {
    return { __error_lectura: String(e.message) };
  }
};

const listarDirs = (ruta) =>
  !existsSync(ruta)
    ? []
    : readdirSync(ruta, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();

function escribir(rutaRelativa, obj) {
  const ruta = join(OUT, rutaRelativa);
  const dir = ruta.split('/').slice(0, -1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(ruta, JSON.stringify(obj, null, 2), 'utf8');
  console.log(`  escrito  ${ruta}  (${(Buffer.byteLength(JSON.stringify(obj)) / 1024).toFixed(1)} KB)`);
}

function mediana(nums) {
  const a = nums.filter((n) => typeof n === 'number').sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

// ---------- 1. inventario de capturas y triaje ----------

console.log('Leyendo capturas...');

const todasLasCapturas = [];
for (const fecha of listarDirs(DATA)) {
  for (const hora of listarDirs(join(DATA, fecha))) {
    todasLasCapturas.push({ id: `${fecha}/${hora}`, fecha, hora, dir: join(DATA, fecha, hora) });
  }
}
todasLasCapturas.sort((a, b) => a.id.localeCompare(b.id));

if (!todasLasCapturas.length) {
  console.error('ERROR: no se encontró ninguna captura en data/. ¿Estás en ~/farma-historico?');
  process.exit(1);
}

/** Busca medicamentos distintos con texto crudo idéntico dentro de una misma pasada. */
function detectarContaminacion(capturaId) {
  const dirRaw = join(RAW, capturaId);
  if (!existsSync(dirRaw)) return null;
  const porHuella = new Map();
  for (const archivo of readdirSync(dirRaw)) {
    if (!archivo.endsWith('.txt') || archivo.startsWith('_')) continue;
    let datos;
    try {
      datos = readFileSync(join(dirRaw, archivo));
    } catch {
      continue;
    }
    if (datos.length < MIN_BYTES_DETALLE) continue; // fallo declarado, no cuenta
    const huella = createHash('md5').update(datos).digest('hex');
    if (!porHuella.has(huella)) porHuella.set(huella, []);
    porHuella.get(huella).push(archivo.replace(/\.txt$/, ''));
  }
  const grupos = [...porHuella.values()].filter((g) => g.length > 1);
  return grupos.length ? grupos : null;
}

const capturas = [];
const exclusiones = [];

for (const cap of todasLasCapturas) {
  const bajoElPiso = cap.id < PISO_CAPTURA;
  const contaminada = detectarContaminacion(cap.id);

  const motivos = [];
  if (bajoElPiso) motivos.push('fase_construccion');
  if (contaminada) motivos.push('contaminacion_sesion');

  if (motivos.length && !INCLUIR_TODO) {
    exclusiones.push({
      captura: cap.id,
      motivos,
      medicamentos_duplicados: contaminada ?? undefined,
      explicacion: contaminada
        ? 'Dos medicamentos distintos devolvieron texto crudo idéntico: el estado de sesión del sitio no se limpió entre búsquedas, y una búsqueda devolvió el resultado de la anterior.'
        : 'Captura anterior a la estabilización del pipeline. Se conserva el crudo pero no se usa para análisis.',
    });
    continue;
  }

  if (motivos.length && INCLUIR_TODO) {
    console.log(`  AVISO: incluyendo captura marcada ${cap.id} (${motivos.join(', ')}) por --todo`);
  }
  capturas.push(cap);
}

console.log(`  ${todasLasCapturas.length} capturas en disco`);
console.log(`  ${capturas.length} incluidas · ${exclusiones.length} excluidas`);
if (INCLUIR_TODO) console.log('  MODO --todo: incluye dato sucio. NO publicar esta salida.');

if (!capturas.length) {
  console.error('ERROR: el piso dejó fuera todas las capturas. Revisa PISO_CAPTURA o usa --todo.');
  process.exit(1);
}

// ---------- 2. cargar observaciones ----------

const medicamentos = new Map();
const portadas = [];
const saludCapturas = [];

for (const cap of capturas) {
  let archivos = [];
  try {
    archivos = readdirSync(cap.dir).filter((f) => f.endsWith('.json'));
  } catch {
    continue;
  }

  if (archivos.includes('_portada.json')) {
    const p = leerJSON(join(cap.dir, '_portada.json'));
    portadas.push({ captura: cap.id, ...p });
  }

  let okCount = 0;
  let falloCount = 0;

  for (const archivo of archivos) {
    if (archivo.startsWith('_')) continue;
    const d = leerJSON(join(cap.dir, archivo));
    const id = d.medicamento_id ?? archivo.replace(/\.json$/, '');

    if (!medicamentos.has(id)) {
      medicamentos.set(id, {
        medicamento_id: id,
        medicamento_nombre: d.medicamento_nombre ?? id,
        medicamento_termino: d.medicamento_termino ?? null,
        observaciones: [],
      });
    }
    const m = medicamentos.get(id);
    if (d.medicamento_nombre) m.medicamento_nombre = d.medicamento_nombre;

    const ok = d.ok === true;
    ok ? okCount++ : falloCount++;

    m.observaciones.push({
      captura: cap.id,
      capturado_en: d.capturado_en ?? null,
      ok,
      etapa: d.etapa ?? null,
      error: d.error ?? d.__error_lectura ?? null,
      estado: ok ? (d.estado ?? null) : null,
      instalaciones: ok && Array.isArray(d.instalaciones) ? d.instalaciones : null,
    });
  }

  saludCapturas.push({ captura: cap.id, medicamentos_ok: okCount, medicamentos_fallidos: falloCount });
}

// ---------- 3. series por medicamento ----------

console.log('Construyendo series por medicamento...');

const indice = [];

for (const [id, m] of medicamentos) {
  m.observaciones.sort((a, b) => a.captura.localeCompare(b.captura));

  const instalaciones = new Map();

  for (const obs of m.observaciones) {
    if (!obs.ok || !obs.instalaciones) {
      for (const inst of instalaciones.values()) {
        inst.puntos.push({
          captura: obs.captura,
          capturado_en: obs.capturado_en,
          estado_captura: 'no_capturado',
          motivo: obs.error ?? obs.etapa ?? 'desconocido',
          cantidad: null,
          dias: null,
          dias_no_publicado: null,
        });
      }
      continue;
    }

    const vistas = new Set();

    for (const inst of obs.instalaciones) {
      const nombre = inst.nombre ?? '(sin nombre)';
      vistas.add(nombre);

      if (!instalaciones.has(nombre)) {
        instalaciones.set(nombre, {
          nombre,
          es_bodega: inst.es_bodega === true,
          provincia: inst.provincia ?? null,
          corregimiento: inst.corregimiento ?? null,
          etiquetas: inst.etiquetas ?? [],
          unidad: inst.unidad ?? null,
          puntos: [],
        });
      }
      const reg = instalaciones.get(nombre);
      if (inst.unidad) reg.unidad = inst.unidad;
      if (inst.provincia) reg.provincia = inst.provincia;

      reg.puntos.push({
        captura: obs.captura,
        capturado_en: obs.capturado_en,
        estado_captura: 'ok',
        cantidad: typeof inst.cantidad === 'number' ? inst.cantidad : null,
        cantidad_texto: inst.cantidad_texto ?? null,
        dias: typeof inst.dias_abastecimiento === 'number' ? inst.dias_abastecimiento : null,
        dias_no_publicado: inst.dias_no_publicado === true,
        avisos: Array.isArray(inst.avisos) && inst.avisos.length ? inst.avisos : undefined,
      });
    }

    for (const [nombre, reg] of instalaciones) {
      if (!vistas.has(nombre)) {
        reg.puntos.push({
          captura: obs.captura,
          capturado_en: obs.capturado_en,
          estado_captura: 'no_listada',
          cantidad: null,
          dias: null,
          dias_no_publicado: null,
        });
      }
    }
  }

  const lista = [...instalaciones.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const atencion = lista.filter((i) => !i.es_bodega);
  const bodegas = lista.filter((i) => i.es_bodega);

  const ultimos = atencion
    .map((i) => [...i.puntos].reverse().find((p) => p.estado_captura === 'ok'))
    .filter(Boolean);

  const sinDias = ultimos.filter((p) => p.dias_no_publicado === true);
  const conDias = ultimos.filter((p) => p.dias_no_publicado !== true);

  const salida = {
    medicamento_id: id,
    medicamento_nombre: m.medicamento_nombre,
    medicamento_termino: m.medicamento_termino,
    fuente: 'https://mifarmadigital.css.gob.pa/medicamentos/buscar/basica',
    generado_en: new Date().toISOString(),
    capturas_analizadas: m.observaciones.map((o) => ({
      captura: o.captura,
      capturado_en: o.capturado_en,
      ok: o.ok,
      error: o.error,
    })),
    instalaciones_atencion: atencion,
    bodegas,
    metricas: {
      instalaciones_atencion: atencion.length,
      bodegas: bodegas.length,
      capturas_ok: m.observaciones.filter((o) => o.ok).length,
      capturas_fallidas: m.observaciones.filter((o) => !o.ok).length,
      sin_dias_publicados: sinDias.length,
      con_dias_publicados: conDias.length,
      mediana_cantidad_sin_dias: mediana(sinDias.map((p) => p.cantidad)),
      mediana_cantidad_con_dias: mediana(conDias.map((p) => p.cantidad)),
    },
  };

  escribir(`medicamentos/${id}.json`, salida);

  indice.push({
    medicamento_id: id,
    medicamento_nombre: m.medicamento_nombre,
    instalaciones_atencion: atencion.length,
    bodegas: bodegas.length,
    capturas_fallidas: salida.metricas.capturas_fallidas,
    sin_dias_publicados: sinDias.length,
    mediana_cantidad_sin_dias: salida.metricas.mediana_cantidad_sin_dias,
    mediana_cantidad_con_dias: salida.metricas.mediana_cantidad_con_dias,
  });
}

escribir('medicamentos/index.json', {
  generado_en: new Date().toISOString(),
  total: indice.length,
  medicamentos: indice.sort((a, b) => a.medicamento_id.localeCompare(b.medicamento_id)),
});

// ---------- 4. cambios ----------

console.log('Detectando cambios de inventario...');

const cambios = [];
let paresComparados = 0;
let paresSaltados = 0;

for (const [id, m] of medicamentos) {
  const obs = m.observaciones;
  for (let i = 1; i < obs.length; i++) {
    const antes = obs[i - 1];
    const ahora = obs[i];

    if (!antes.ok || !ahora.ok || !antes.instalaciones || !ahora.instalaciones) {
      paresSaltados++;
      continue;
    }
    paresComparados++;

    const mapaAntes = new Map(antes.instalaciones.map((x) => [x.nombre ?? '(sin nombre)', x]));
    const base = {
      medicamento_id: id,
      medicamento_nombre: m.medicamento_nombre,
      captura_antes: antes.captura,
      captura_despues: ahora.captura,
      cuando: ahora.capturado_en,
    };

    for (const inst of ahora.instalaciones) {
      const nombre = inst.nombre ?? '(sin nombre)';
      const prev = mapaAntes.get(nombre);
      const b = typeof inst.cantidad === 'number' ? inst.cantidad : null;

      if (!prev) {
        cambios.push({
          ...base,
          tipo: 'aparece',
          instalacion: nombre,
          provincia: inst.provincia ?? null,
          es_bodega: inst.es_bodega === true,
          cantidad_antes: null,
          cantidad_despues: b,
          unidad: inst.unidad ?? null,
        });
        continue;
      }

      const a = typeof prev.cantidad === 'number' ? prev.cantidad : null;
      const diasAntes = prev.dias_no_publicado === true ? null : (prev.dias_abastecimiento ?? null);
      const diasDespues = inst.dias_no_publicado === true ? null : (inst.dias_abastecimiento ?? null);

      if (a !== null && b !== null && a !== b) {
        cambios.push({
          ...base,
          tipo: b < a ? 'baja' : 'sube',
          instalacion: nombre,
          provincia: inst.provincia ?? null,
          es_bodega: inst.es_bodega === true,
          cantidad_antes: a,
          cantidad_despues: b,
          delta: b - a,
          unidad: inst.unidad ?? null,
          dias_antes: diasAntes,
          dias_despues: diasDespues,
        });
      }

      if (prev.dias_no_publicado !== inst.dias_no_publicado) {
        cambios.push({
          ...base,
          tipo: inst.dias_no_publicado === true ? 'deja_de_publicar_dias' : 'empieza_a_publicar_dias',
          instalacion: nombre,
          provincia: inst.provincia ?? null,
          es_bodega: inst.es_bodega === true,
          cantidad_antes: a,
          cantidad_despues: b,
          dias_antes: diasAntes,
          dias_despues: diasDespues,
          unidad: inst.unidad ?? null,
        });
      }
    }

    const nombresAhora = new Set(ahora.instalaciones.map((x) => x.nombre ?? '(sin nombre)'));
    for (const [nombre, prev] of mapaAntes) {
      if (!nombresAhora.has(nombre)) {
        cambios.push({
          ...base,
          tipo: 'desaparece',
          instalacion: nombre,
          provincia: prev.provincia ?? null,
          es_bodega: prev.es_bodega === true,
          cantidad_antes: typeof prev.cantidad === 'number' ? prev.cantidad : null,
          cantidad_despues: null,
          unidad: prev.unidad ?? null,
        });
      }
    }
  }
}

cambios.sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)));

escribir('cambios.json', {
  generado_en: new Date().toISOString(),
  nota: 'Un cambio solo se registra entre dos capturas incluidas y exitosas del mismo medicamento. Los fallos de captura no producen cambios, y las capturas excluidas no se comparan.',
  total: cambios.length,
  pares_comparados: paresComparados,
  pares_saltados_por_fallo: paresSaltados,
  por_tipo: cambios.reduce((acc, c) => ((acc[c.tipo] = (acc[c.tipo] ?? 0) + 1), acc), {}),
  cambios: cambios.slice(0, 3000),
});

// ---------- 5. resumen con exclusiones declaradas ----------

console.log('Escribiendo resumen...');

const primera = capturas[0];
const ultima = capturas[capturas.length - 1];

const porMotivo = exclusiones.reduce((acc, e) => {
  for (const mo of e.motivos) acc[mo] = (acc[mo] ?? 0) + 1;
  return acc;
}, {});

const nContaminadas = exclusiones.filter((e) => e.motivos.includes('contaminacion_sesion')).length;

// Texto listo para la pantalla 3. Se arma con los números reales, no a mano.
const textoPantalla =
  exclusiones.length === 0
    ? `Las ${todasLasCapturas.length} capturas registradas se usan para el análisis. No se ha descartado ninguna.`
    : `De ${todasLasCapturas.length} capturas registradas, ${capturas.length} se usan para el análisis. ` +
      `Las ${exclusiones.length} excluidas son de la fase de construcción del pipeline` +
      (nContaminadas
        ? `; en ${nContaminadas === 1 ? 'una de ellas' : `${nContaminadas} de ellas`} se detectó contaminación de sesión comparando huellas del texto crudo`
        : '') +
      `. El dato crudo se conserva completo.`;

escribir('resumen.json', {
  generado_en: new Date().toISOString(),
  modo: INCLUIR_TODO ? 'TODO (incluye dato sucio — no publicar)' : 'normal',
  fuente: 'https://mifarmadigital.css.gob.pa/medicamentos/buscar/basica',
  atribucion:
    'Fuente: Mi Farma Digital — Caja de Seguro Social de Panamá. Datos capturados de forma automatizada. Este sitio no está afiliado a la CSS.',

  primera_captura: { id: primera.id, fecha: primera.fecha, hora_utc: primera.hora },
  ultima_captura: { id: ultima.id, fecha: ultima.fecha, hora_utc: ultima.hora },
  total_capturas_en_disco: todasLasCapturas.length,
  total_capturas_analizadas: capturas.length,
  total_medicamentos: medicamentos.size,
  cambios_detectados: cambios.length,

  // Para la pantalla 3: qué se descartó y por qué. Se muestra, no se esconde.
  exclusiones: {
    texto_para_pantalla: textoPantalla,
    piso_captura: PISO_CAPTURA,
    total_excluidas: exclusiones.length,
    por_motivo: porMotivo,
    glosario_motivos: {
      fase_construccion:
        'Captura hecha mientras el pipeline aún se estaba construyendo. Puede estar incompleta o usar una versión anterior del parser.',
      contaminacion_sesion:
        'Dos medicamentos distintos devolvieron texto idéntico. El sitio conserva estado de sesión entre búsquedas; si no se limpia, una búsqueda devuelve el resultado de la anterior.',
    },
    detalle: exclusiones,
  },

  portada_nacional_ultima: portadas.length ? portadas[portadas.length - 1] : null,
  portada_nacional_serie: portadas.map((p) => ({
    captura: p.captura,
    capturado_en: p.capturado_en ?? null,
    total_lom: p.total_lom ?? p.total ?? null,
    disponibles: p.disponibles ?? null,
    porcentaje: p.porcentaje ?? null,
    dias_abastecimiento: p.dias_abastecimiento ?? p.dias ?? null,
  })),
  salud_capturas: saludCapturas,
});

console.log('\nListo.');
console.log(`  analizadas: ${capturas.length}/${todasLasCapturas.length}  medicamentos: ${medicamentos.size}  cambios: ${cambios.length}`);
if (exclusiones.length) {
  console.log(`  excluidas: ${exclusiones.map((e) => `${e.captura} (${e.motivos.join('+')})`).join(', ')}`);
}
console.log(`\n  Texto para la pantalla de metodología:\n  "${textoPantalla}"`);

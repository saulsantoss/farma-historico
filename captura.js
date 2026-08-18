import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { parseDetalle, parsePortada } from "./parser.js";

const BASE = "https://mifarmadigital.css.gob.pa/medicamentos/buscar/basica";
const PAUSA_ENTRE_MEDICAMENTOS = 3000;
const ESPERA_BLAZOR = 7000;

function sello() {
  const iso = new Date().toISOString();
  return { iso, fecha: iso.slice(0, 10), hora: iso.slice(11, 13) + iso.slice(14, 16) + "Z" };
}

async function elegirOpcion(page, nombre) {
  const intentos = [
    page.getByRole("button", { name: nombre, exact: true }),
    page.getByRole("button", { name: nombre, exact: false }),
    page.getByRole("button", { name: nombre.slice(0, 45), exact: false }),
    page.getByRole("button").filter({ hasText: nombre.slice(0, 45) }),
  ];

  for (const loc of intentos) {
    const el = loc.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      return true;
    }
  }
  return false;
}

async function capturarUno(context, page, med, s, portadaRef) {
  const r = {
    captura_id: `${s.fecha}T${s.hora}`,
    capturado_en: s.iso,
    fuente: BASE,
    medicamento_id: med.id,
    medicamento_termino: med.termino,
    medicamento_nombre: med.nombre,
    ok: false,
    etapa: "inicio",
    error: null,
  };

  try {
    await context.clearCookies();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    r.etapa = "carga";

    let buscador = page.getByRole("searchbox", { name: "Escriba el medicamento..." });
    if (!(await buscador.isVisible().catch(() => false))) {
      buscador = page.locator('input[type="search"]').first();
    }
    await buscador.waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(ESPERA_BLAZOR);
    r.etapa = "blazor-listo";

    const textoInicial = await page.evaluate(() => document.body.innerText);
    if (!portadaRef.capturada && /Lista Oficial de Medicamentos/i.test(textoInicial)) {
      Object.assign(portadaRef, parsePortada(textoInicial), { capturada: true, texto: textoInicial });
    }

    await buscador.click();
    await buscador.fill("");
    await page.waitForTimeout(400);
    await buscador.fill(med.termino);
    r.etapa = "tecleo";
    await page.waitForTimeout(4000);

    let elegido = await elegirOpcion(page, med.nombre);

    if (!elegido) {
      await buscador.fill("");
      await page.waitForTimeout(600);
      await buscador.type(med.termino, { delay: 130 });
      await page.waitForTimeout(5000);
      elegido = await elegirOpcion(page, med.nombre);
    }

    if (!elegido) {
      const visibles = await page.evaluate(() =>
        [...document.querySelectorAll('button, [role="button"]')]
          .map((b) => (b.innerText || "").trim().split("\n")[0])
          .filter((t) => t && t.length > 12)
          .slice(0, 12)
      );
      throw new Error("Opcion no encontrada. Botones visibles: " + JSON.stringify(visibles));
    }

    r.etapa = "opcion-elegida";
    await page.waitForTimeout(1200);

    await page.getByRole("button", { name: "Buscar" }).click();
    r.etapa = "buscar";

    await page.waitForFunction(
      () => document.body.innerText.includes("Cantidad en inventario"),
      { timeout: 40000 }
    );
    await page.waitForTimeout(2000);
    r.etapa = "detalle";

    const texto = await page.evaluate(() => document.body.innerText);
    r.texto_crudo = texto;

    if (!texto.includes(med.nombre)) throw new Error("El detalle no corresponde al medicamento pedido");

    Object.assign(r, parseDetalle(texto));
    if (r.total_instalaciones === 0) throw new Error("Detalle sin instalaciones parseadas");
    r.ok = true;
  } catch (e) {
    r.error = String(e.message || e).slice(0, 500);
    try {
      r.texto_crudo = await page.evaluate(() => document.body.innerText);
    } catch {}
  }

  return r;
}

async function main() {
  const meds = JSON.parse(await readFile("medicamentos.json", "utf8")).filter(
    (m) => !m.id.startsWith("PENDIENTE-")
  );

  if (meds.length === 0) {
    console.error("No hay medicamentos configurados.");
    process.exit(1);
  }

  const s = sello();
  const dirData = `data/${s.fecha}/${s.hora}`;
  const dirRaw = `raw/${s.fecha}/${s.hora}`;
  await mkdir(dirData, { recursive: true });
  await mkdir(dirRaw, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "es-PA", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const portada = { capturada: false };
  const resumen = [];

  for (const med of meds) {
    console.log(`\u2192 ${med.id}`);
    const r = await capturarUno(context, page, med, s, portada);

    const { texto_crudo, ...limpio } = r;
    await writeFile(`${dirData}/${med.id}.json`, JSON.stringify(limpio, null, 2));
    await writeFile(`${dirRaw}/${med.id}.txt`, texto_crudo || "");

    resumen.push({
      id: med.id,
      ok: r.ok,
      etapa: r.etapa,
      estado: r.estado || null,
      instalaciones: r.total_instalaciones ?? 0,
      calidad: r.calidad ?? null,
      error: r.error,
    });

    console.log(
      `  ${r.ok ? "ok" : "FALLO(" + r.etapa + ")"} \u00b7 ${r.total_instalaciones ?? 0} instalaciones`
    );
    await page.waitForTimeout(PAUSA_ENTRE_MEDICAMENTOS);
  }

  const { capturada, texto, ...portadaLimpia } = portada;
  await writeFile(
    `${dirData}/_portada.json`,
    JSON.stringify({ captura_id: `${s.fecha}T${s.hora}`, capturado_en: s.iso, ...portadaLimpia }, null, 2)
  );
  if (texto) await writeFile(`${dirRaw}/_portada.txt`, texto);

  await writeFile(
    `${dirData}/_resumen.json`,
    JSON.stringify(
      { captura_id: `${s.fecha}T${s.hora}`, capturado_en: s.iso, portada: portadaLimpia, resumen },
      null,
      2
    )
  );

  await browser.close();

  const fallos = resumen.filter((r) => !r.ok).length;
  const obs = resumen.reduce((a, r) => a + r.instalaciones, 0);
  console.log(`\nCaptura ${s.fecha} ${s.hora} \u2014 ${resumen.length - fallos}/${resumen.length} ok \u00b7 ${obs} observaciones`);
  console.log(
    `Portada: ${portadaLimpia.disponibles_n}/${portadaLimpia.lom_total} \u00b7 ${portadaLimpia.disponibles_pct}% \u00b7 ${portadaLimpia.dias_abastecimiento_nacional} d\u00edas`
  );
}

main();

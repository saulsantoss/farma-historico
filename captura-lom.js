import { chromium } from "playwright";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = "https://mifarmadigital.css.gob.pa/medicamentos/buscar/basica";
const ESPERA_BLAZOR = 7000;

function sello() {
  const iso = new Date().toISOString();
  return { iso, fecha: iso.slice(0, 10), hora: iso.slice(11, 13) + iso.slice(14, 16) + "Z" };
}

function parseCSV(texto) {
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const cab = lineas[0].split(";").map((c) => c.trim());
  return lineas.slice(1).map((l) => {
    const v = l.split(";");
    const o = {};
    cab.forEach((c, i) => (o[c] = (v[i] || "").trim()));
    return o;
  });
}

async function main() {
  const s = sello();
  const dirLom = "lom";
  await mkdir(dirLom, { recursive: true });

  const destinoCsv = `${dirLom}/${s.fecha}.csv`;
  const destinoJson = `${dirLom}/${s.fecha}.json`;

  if (existsSync(destinoCsv) && !process.argv.includes("--forzar")) {
    console.log(`Ya existe ${destinoCsv}. Usa --forzar para volver a capturar.`);
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "es-PA",
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const registro = {
    capturado_en: s.iso,
    fuente: BASE,
    ok: false,
    error: null,
  };

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('input[type="search"]').first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(ESPERA_BLAZOR);

    await page.getByRole("button", { name: /Ver lista oficial de medicamentos/i }).first().click();

    await page.waitForFunction(
      () => /Lista Oficial de Medicamentos \(LOM\)/i.test(document.body.innerText),
      { timeout: 25000 }
    );
    await page.waitForTimeout(2000);

    const encabezado = await page.evaluate(() => {
      const l = document.body.innerText.split("\n").map((x) => x.trim());
      const i = l.findIndex((x) => /medicamentos cubiertos por la Caja/i.test(x));
      return i !== -1 ? l[i] : null;
    });
    registro.encabezado_modal = encabezado;

    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 40000 }),
      page.getByRole("button", { name: /Descargar en Excel/i }).first().click(),
    ]);

    registro.nombre_archivo_origen = descarga.suggestedFilename();
    await descarga.saveAs(destinoCsv);

    const texto = await readFile(destinoCsv, "utf8");
    const filas = parseCSV(texto);

    registro.total = filas.length;
    registro.columnas = Object.keys(filas[0] || {});
    registro.codigos_unicos = new Set(filas.map((f) => f["Código"])).size;

    const porPresentacion = {};
    for (const f of filas) {
      const p = f["Presentación"] || "(sin dato)";
      porPresentacion[p] = (porPresentacion[p] || 0) + 1;
    }
    registro.por_presentacion = porPresentacion;

    await writeFile(
      destinoJson,
      JSON.stringify({ ...registro, ok: true, medicamentos: filas }, null, 2)
    );

    registro.ok = true;
  } catch (e) {
    registro.error = String(e.message || e).slice(0, 500);
  }

  await browser.close();

  await writeFile(`${dirLom}/_ultimo.json`, JSON.stringify(registro, null, 2));

  if (!registro.ok) {
    console.error("FALLO:", registro.error);
    process.exit(1);
  }

  console.log(`LOM ${s.fecha}: ${registro.total} renglones, ${registro.codigos_unicos} codigos unicos`);
  console.log(`Origen: ${registro.nombre_archivo_origen}`);

  const previos = (await readdir(dirLom))
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  if (previos.length > 1) {
    const anterior = JSON.parse(await readFile(`${dirLom}/${previos[previos.length - 2]}`, "utf8"));
    const antes = new Map(anterior.medicamentos.map((m) => [m["Código"], m["Nombre genérico"]]));
    const ahora = new Map(
      JSON.parse(await readFile(destinoJson, "utf8")).medicamentos.map((m) => [
        m["Código"],
        m["Nombre genérico"],
      ])
    );

    const entraron = [...ahora.keys()].filter((k) => !antes.has(k));
    const salieron = [...antes.keys()].filter((k) => !ahora.has(k));

    console.log(`\nContra ${previos[previos.length - 2]}:`);
    console.log(`  Entraron: ${entraron.length}`);
    entraron.slice(0, 10).forEach((k) => console.log(`    + ${k} ${ahora.get(k)}`));
    console.log(`  Salieron: ${salieron.length}`);
    salieron.slice(0, 10).forEach((k) => console.log(`    - ${k} ${antes.get(k)}`));
  }
}

main();

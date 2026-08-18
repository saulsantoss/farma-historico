import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseDetalle, parsePortada } from "./parser.js";

async function main() {
  if (!existsSync("raw")) {
    console.error("No existe la carpeta raw/");
    process.exit(1);
  }

  const fechas = (await readdir("raw")).sort();
  let pasadas = 0;
  let archivos = 0;
  const problemas = [];

  for (const fecha of fechas) {
    const horas = (await readdir(`raw/${fecha}`)).sort();

    for (const hora of horas) {
      const dirRaw = `raw/${fecha}/${hora}`;
      const dirData = `data/${fecha}/${hora}`;
      await mkdir(dirData, { recursive: true });

      const txts = (await readdir(dirRaw)).filter((f) => f.endsWith(".txt"));
      pasadas++;

      for (const txt of txts) {
        const id = txt.replace(/\.txt$/, "");
        const texto = await readFile(`${dirRaw}/${txt}`, "utf8");
        if (!texto.trim()) continue;

        const destino = `${dirData}/${id}.json`;
        const previo = existsSync(destino)
          ? JSON.parse(await readFile(destino, "utf8"))
          : {};

        if (id === "_portada") {
          await writeFile(
            destino.replace("_portada.json", "_portada.json"),
            JSON.stringify({ ...previo, ...parsePortada(texto), reparseado: true }, null, 2)
          );
          archivos++;
          continue;
        }

        if (!texto.includes("Cantidad en inventario")) continue;

        const parsed = parseDetalle(texto);
        const salida = {
          ...previo,
          ok: parsed.total_instalaciones > 0,
          ...parsed,
          reparseado_en: new Date().toISOString(),
        };
        delete salida.error;

        await writeFile(destino, JSON.stringify(salida, null, 2));
        archivos++;

        if (!parsed.calidad.cabecera_detectada || parsed.calidad.sin_nombre > 0) {
          problemas.push({
            archivo: `${fecha}/${hora}/${id}`,
            cabecera: parsed.calidad.cabecera_detectada,
            sin_nombre: parsed.calidad.sin_nombre,
          });
        }
      }
    }
  }

  console.log(`Reparseadas ${pasadas} pasadas, ${archivos} archivos.`);

  if (problemas.length) {
    console.log(`\n${problemas.length} con observaciones:`);
    problemas.slice(0, 15).forEach((p) =>
      console.log(`  ${p.archivo} cabecera=${p.cabecera} sin_nombre=${p.sin_nombre}`)
    );
  } else {
    console.log("Sin problemas de parseo.");
  }
}

main();

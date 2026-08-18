import { readFile } from "node:fs/promises";
import path from "node:path";
import VistaMedicamento from "./vista";

// Los datos se cargan en el cliente; el índice solo se lee aquí para
// prerenderizar una ruta por medicamento monitoreado.
export async function generateStaticParams() {
  try {
    const ruta = path.join(
      process.cwd(),
      "public",
      "medicamentos",
      "index.json",
    );
    const indice = JSON.parse(await readFile(ruta, "utf8"));
    return (indice.medicamentos ?? []).map((m) => ({ id: m.medicamento_id }));
  } catch {
    return [];
  }
}

export default function PaginaMedicamento() {
  return <VistaMedicamento />;
}

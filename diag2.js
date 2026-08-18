import { chromium } from "playwright";

const NOMBRE = "PARACETAMOL (ACETAMINOFÉN) 500mg, tableta, V.O.";
const BASE = "https://mifarmadigital.css.gob.pa/medicamentos/buscar/basica";

const b = await chromium.launch({ headless: false, slowMo: 200 });
const ctx = await b.newContext({ locale: "es-PA", viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });

const inp = p.locator('input[type="search"]').first();
await inp.waitFor({ state: "visible", timeout: 30000 });
await p.waitForTimeout(7000);

await inp.click();
await inp.type("paracetamol", { delay: 130 });
await p.waitForTimeout(6000);

const info = await p.evaluate((nombre) => {
  const todos = [...document.querySelectorAll("*")];
  const hoja = todos.find((e) => e.children.length === 0 && e.textContent.trim() === nombre);

  if (!hoja) {
    return {
      encontrado: false,
      candidatos: todos
        .filter((e) => e.children.length === 0 && /PARACETAMOL/i.test(e.textContent))
        .slice(0, 6)
        .map((e) => ({ tag: e.tagName, texto: e.textContent.trim().slice(0, 90) })),
    };
  }

  const cadena = [];
  let cur = hoja;
  for (let i = 0; i < 7 && cur; i++) {
    const cs = getComputedStyle(cur);
    cadena.push({
      nivel: i,
      tag: cur.tagName,
      clase: String(cur.className || "").slice(0, 130),
      role: cur.getAttribute("role"),
      tabindex: cur.getAttribute("tabindex"),
      cursor: cs.cursor,
      hijos: cur.children.length,
      texto: cur.innerText.trim().replace(/\n/g, " | ").slice(0, 110),
    });
    cur = cur.parentElement;
  }
  return { encontrado: true, cadena };
}, NOMBRE);

console.log("=== CADENA DE ANCESTROS ===");
console.log(JSON.stringify(info, null, 2));

console.log("\nVentana abierta 2 min. Haz clic MANUAL en la fila de PARACETAMOL 500mg y observa si entra al detalle.");
await p.waitForTimeout(120000);
await b.close();

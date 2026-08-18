import { chromium } from "playwright";

const b = await chromium.launch({ headless: false, slowMo: 300 });
const ctx = await b.newContext({ locale: "es-PA", viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

await p.goto("https://mifarmadigital.css.gob.pa/medicamentos/buscar/basica", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(6000);

const inputs = await p.evaluate(() =>
  [...document.querySelectorAll("input, textarea")].map((e, i) => ({
    i,
    tag: e.tagName,
    type: e.type || null,
    placeholder: e.placeholder || null,
    id: e.id || null,
    clase: (e.className || "").slice(0, 90),
    visible: !!(e.offsetWidth || e.offsetHeight),
  }))
);

console.log("=== CAMPOS DE ENTRADA ===");
console.log(JSON.stringify(inputs, null, 2));
console.log("\n=== TEXTO DE LA PAGINA (primeros 800) ===");
console.log((await p.evaluate(() => document.body.innerText)).slice(0, 800));

console.log("\nLa ventana queda abierta 90s. Escribe 'paracetamol' a mano y observa.");
await p.waitForTimeout(90000);
await b.close();

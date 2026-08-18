# Proyecto Serie CSS — Estado completo

**Saúl Santos** · Actualizado: martes 18 de agosto de 2026, 01:00 a.m.
**Evento: miércoles 19 de agosto, 4:00–8:00 pm, Ciudad de la Salud**

---

## 1. El evento

| | |
|---|---|
| Formato | Curso práctico de un solo día, 4 horas (4–8pm) |
| Organiza | Multiplai (Adam Eisenman), patrocina la CSS |
| Participantes | 50 seleccionados de ~360 aplicantes (32 UTP, 18 UP) |
| Modalidad | Equipos, sin requisito de saber programar |
| Herramientas | Claude Code (acceso donado) + Vercel |
| Salida esperada | Un proyecto publicado en una URL pública |
| Premio | Los 3 mejores se presentan a las autoridades de la CSS |

**Doble marco.** El kit de Multiplai está escrito para "construye tu negocio en una tarde". El comunicado de la CSS habla de soluciones a retos institucionales. Hay que llegar con algo que funcione en los dos.

---

## 2. La propuesta

### Frase de una línea

> Un servicio de transparencia que convierte los datos públicos de medicamentos de la CSS en un histórico verificable — para pacientes crónicos, periodistas y la propia institución.

### La tesis

**Mi Farma Digital es una pizarra que se borra sola.** Muestra el inventario ahora mismo; cuando cambia, lo anterior desaparece para siempre. No hay botón de historial.

El proyecto le toma foto cada 3 horas y guarda las fotos con fecha. **El activo no es el código — es el tiempo.** Quien copie el jueves empieza en cero y nunca recupera los días perdidos, porque la CSS no los guardó.

### Lo que no es

- No es un sistema de seguridad. La seguridad es *cómo* se construye, no *qué*.
- No es una app para el paciente. Mi Farma Digital ya resuelve el "¿hay hoy?".

### Encuadre para la sala

No es *"auditamos a la CSS"*. Es **"la CSS mide su propio desempeño y lo publica antes de que se lo pregunten."**

**Cierre recomendado — regalar, no vender:**

> "Esto que construí desde afuera con un navegador automatizado, ustedes lo pueden hacer desde adentro con una consulta a su propia base de datos y un cron. Mejor, más completo y más barato que yo. Lo único que hace falta es guardar lo que ya publican. Yo guardé estas semanas porque nadie las estaba guardando — se las dejo como línea base."

Elimina la lectura de fiscalización, demuestra que entiendes su operación, y convierte el pedido en algo aprobable sin presupuesto ni licitación.

### Línea de pitch más fuerte

> "El instrumento de verificación más usado hoy en la CSS es el screenshot. Yo lo automaticé."

(Sale de los testimonios del sistema mixto de pensiones: la gente guarda capturas de pantalla porque la plataforma no conserva lo que dijo antes. Mismo patrón, otro dominio.)

---

## 3. Estado técnico

### Repositorio

- **`github.com/saulsantoss/farma-historico`** — público
- Local: `~/farma-historico` en ThinkPad T14 / EndeavourOS
- Rama `main`, identidad local: `Saul Santos <saulsantos1205@gmail.com>`
- Primer commit: 17 de agosto, ~23:20 (prueba de trabajo previo al evento)

### Archivos

```
farma-historico/
├── captura.js              captura los 14 medicamentos (importa parser.js)
├── captura-lom.js          descarga el CSV de la Lista Oficial (1×/día)
├── parser.js               parser compartido — única fuente de verdad
├── reparse.js              reprocesa todo raw/ con el parser actual
├── medicamentos.json       los 14 medicamentos con nombre canónico
├── package.json            type: module, playwright
├── .gitignore              node_modules/, captura.log, diag*.js
├── .github/workflows/
│   └── captura.yml         cron cada 3 horas + workflow_dispatch
├── data/YYYY-MM-DD/HHMMZ/  JSON parseado + _portada.json + _resumen.json
├── raw/YYYY-MM-DD/HHMMZ/   texto crudo de cada página (red de seguridad)
└── lom/YYYY-MM-DD.csv|json Lista Oficial con códigos de 9 dígitos
```

### Cómo funciona la captura

1. Playwright abre Chromium headless
2. `goto` a `mifarmadigital.css.gob.pa/medicamentos/buscar/basica`
3. Espera 7s el circuito de Blazor Server
4. Captura la portada nacional (una vez por pasada)
5. Por cada medicamento: limpia cookies → escribe el término → clic en el botón de la opción → **clic en el botón Buscar** → espera el detalle → guarda `innerText`
6. `parser.js` extrae instalaciones, cantidades, días, avisos
7. Escribe `data/` (parseado) y `raw/` (crudo)

**Trampas de Blazor descubiertas:**
- El input es `type="search"`, no `"text"`
- La fila de resultado es un `<button>` cuyo nombre accesible es el nombre del medicamento
- **Después de elegir la opción hay que hacer clic en "Buscar"** — sin eso no pasa nada
- El sitio guarda estado de sesión: hay que limpiar cookies entre medicamentos o capturas el medicamento anterior
- El autocompletado es intermitente (carvedilol falló y al reintentar funcionó) → hay reintento con tecleo letra por letra
- Términos de búsqueda: **una sola palabra distintiva**. "insulina glargina" falla, "glargina" funciona

### Automatización — dos vías redundantes

**GitHub Actions** (`.github/workflows/captura.yml`)
- Cron `0 */3 * * *` (UTC) → en Panamá: 2am, 5am, 8am, 11am, 2pm, 5pm, 8pm, 11pm
- Runner Ubuntu limpio, instala Node 22 + Chromium cada vez (~4 min)
- Commitea como `captura-bot <actions@github.com>`
- Usa el `GITHUB_TOKEN` temporal de GitHub, **no** credenciales personales
- Primera corrida manual: ✅ Success 3m58s

**Cron local** (ThinkPad)
```
0 */3 * * * cd /home/sauul/farma-historico && /home/sauul/.local/bin/node captura.js >> captura.log 2>&1
```
Los archivos llevan hora en el nombre, así que las dos vías no chocan — solo generan más datos.

### Vercel

- Cuenta `saulsantos1205-1137`, equipo `saulsantos` (Hobby, gratis)
- GitHub `saulsantoss` ya enlazado a Vercel
- Deploy de prueba funcionando: `mi-prueba-five-theta.vercel.app`
- **Aún no hay proyecto desplegado para farma-historico** — pendiente

### Seguridad y aislamiento

- `gh` CLI: **sesión cerrada** (tenía `santoos-kiddie`, causaba que git usara la cuenta equivocada)
- Credential helper: **local al repo**, no global
- `credential.helper=store` guarda el token en texto plano en `~/.git-credentials`
- Historial del repo: solo `Saul Santos` y `captura-bot` — **cero rastro de santhoris**
- Claude Code se abre siempre desde la carpeta del proyecto, nunca desde `~`
- `npm install --ignore-scripts` siempre; Chromium se instala aparte

**Credenciales rotadas esta sesión:** DeepSeek (expuesta en captura previa) y token de GitHub (expuesto en captura de terminal). Ambas por el mismo canal de fuga: capturas de pantalla.

**Pendiente jueves:** borrar `~/Escritorio/token github.txt`, borrar `~/.git-credentials`, revocar el token de GitHub.

---

## 4. Los datos

### Cobertura actual

| | |
|---|---|
| Medicamentos | 14, todos confirmados en la Lista Oficial |
| Observaciones por pasada | ~723 (instalación × medicamento) |
| Frecuencia | cada 3 horas |
| Primera captura | 17 agosto 2026, 21:46 |
| Serie nacional | 531/565 · 94% · 58 días |

### Los 14 medicamentos

paracetamol-500, insulina-glargina, insulina-lispro, insulina-nph, insulina-regular, carbamazepina-200, metformina-850, amlodipina-5, carvedilol-625, hidroclorotiazida-triamtereno, levotiroxina-01, warfarina-5, fluoxetina-20, salbutamol-inhalador

### Campos capturados

**Portada nacional:** total LOM (565), disponibles (531), porcentaje (94%), días de abastecimiento nacional (58)

**Por medicamento:** estado, nombres comerciales, tipos de unidad donde se suministra

**Por instalación:** nombre, etiquetas (Bodega/Hospital/Policlínica/CAPPS/ULAPS), es_bodega, provincia, corregimiento, cantidad, unidad, días de abastecimiento, dias_no_publicado, avisos

**Bloque `calidad`** por captura: cabecera detectada, con/sin días, sin nombre, cuántas bodegas

### Calidad del parseo (tras reparse)

| Campo | Nulos |
|---|---|
| nombre | 0% |
| provincia | 0% |
| cantidad | 0% |
| días (no bodega) | 6% — **es señal, no fallo** (ver abajo) |

---

## 5. Hallazgos

### A. La CSS publica pronósticos que nadie verifica

"Días de abastecimiento" = inventario ÷ ritmo de consumo reciente. Es **una predicción de la institución, publicada, con metodología declarada**. Nadie la está guardando, así que nadie puede comprobar si se cumple.

**Métrica estrella:** de N instalaciones que hoy dicen "menos de 1 día", ¿cuántas seguían con existencia mañana?

Casos identificados para vigilar: **ZAPOTILLO (Veraguas) con 4 días** y **TONOSÍ (Los Santos) con 11 días**.

### B. Stock residual invisible (el hallazgo más fuerte, POR VERIFICAR)

116 observaciones de instalaciones no-bodega sin días de abastecimiento publicados.

- Mediana de cantidad **sin** días: **34 unidades**
- Mediana **con** días: **1,986 unidades**
- Solo 10 de 712 pares alternan → propiedad estable, no intermitencia
- 95 de 116 son insulinas; concentrado en CAPPS y ULAPS

**Hipótesis:** la CSS deja de publicar la estimación cuando queda stock residual mínimo. Esas instalaciones **siguen mostrándose con check verde** — 34 unidades de insulina se ven igual que 20,000.

**Falta verificar** antes de afirmarlo en público.

### C. Cobertura ≠ disponibilidad

El 94% es sobre **565 renglones que la CSS eligió**. Un medicamento fuera de la LOM no cuenta como "no disponible" — no existe en la métrica.

**Verificado contra el CSV oficial (no contra el buscador):**

| Clase | Sí está | No está |
|---|---|---|
| Estatinas | rosuvastatina | atorvastatina, simvastatina |
| IECA | captopril, lisinopril | enalapril |
| ISRS | escitalopram, fluoxetina | sertralina |
| **ARA-II** | **ninguno** | losartán, valsartán |

**Lectura correcta:** la CSS cubre esas clases con agentes distintos — práctica normal de formulario nacional, completamente defendible. **No decir "la CSS no cubre estatinas": es falso y te desarma en público.**

Lo único que aguanta escrutinio: **no hay ningún ARA-II en la LOM**. Losartán es el antihipertensivo más recetado del mundo. Los IECA son la alternativa clínica, así que sigue siendo defendible — preséntalo como observación, no como acusación.

**Regla: toda afirmación sobre la LOM se verifica contra el CSV, nunca contra el buscador** (que es difuso e intermitente).

### D. El denominador se mueve

La prensa reportó **572 renglones** en julio 2026. Hoy son **565**. Si el denominador cambia y nadie lo guarda, los porcentajes de fechas distintas no son comparables. El CSV trae **código de 9 dígitos, 565 únicos** — identificador estable que permite comparación exacta entre fechas. `captura-lom.js` ya hace el diff automático.

### E. Cobertura geográfica

El filtro de provincias lista 9: Bocas del Toro, Chiriquí, Coclé, Colón, Herrera, Los Santos, Panamá, Panamá Oeste, Veraguas. **Falta Darién y no aparece ninguna comarca.**

Probablemente refleja dónde hay farmacias de la CSS conectadas al sistema, no una omisión deliberada. Decirlo sin filo: *"la plataforma cubre 9 de 10 provincias; Darién y las comarcas no aparecen."*

### F. Hallazgos técnicos y legales

**Blazor Server.** Todo va por WebSocket binario; no hay API REST. La única vía es automatización de navegador real.

**`robots.txt`:** `Allow: /` para todos. `Content-Signal: search=yes, ai-train=no, use=reference`. Los `Disallow` son solo para bots de entrenamiento (GPTBot, ClaudeBot, CCBot…). No se entrena nada; el uso es como referencia citando fuente. No hay términos de uso ni footer publicados.

**Mejor argumento para la sala** (de la propia CSS): el comunicado oficial presenta Mi Farma Digital como *"referente regional en transparencia farmacéutica, al ofrecer información pública, unificada y verificable"*. → *"Verificable significa que alguien la verifica. Eso es lo que hice."*

Guardar el `robots.txt` para el ingeniero que pregunte después.

---

## 6. Los 7 principios de diseño

Derivados de las objeciones reales del público en la publicación de la CSS:

| Objeción | Principio | Cómo se demuestra |
|---|---|---|
| "software espagueti sin protocolos" | Cero datos personales por diseño | Ningún dato sensible cruza hacia ningún modelo |
| "3 años de licencia" / empresa de papel | Sin lock-in | Proveedor de IA intercambiable en una línea |
| "tecnologías extranjeras ultra cambiantes" | Núcleo determinista, IA en los bordes | Si el modelo cae, el sistema sigue |
| "¿y el sistema caído?" | Degradación elegante | Cortar la conexión en vivo durante la demo |
| "las IA hacen estragos sin freno" | La IA no decide, explica | Toda salida con justificación y fuente |
| "¿será IA también?" | Etiquetado explícito | Marca visible en texto generado |
| "la rueda está inventada, falta voluntad" | Medir antes de prometer | Línea base publicada |

**El truco del corte de conexión:** cortar internet delante del jurado y que el sistema siga de pie responde al comentario más popular del hilo en diez segundos sin decir una palabra.

---

## 7. Riesgos

### Propiedad intelectual

Contradicción sin resolver: el anexo de la CSS dice que lo desarrollado durante el curso es propiedad *única y exclusiva* de la CSS; el kit de Multiplai dice *"lo que construyas sigue siendo 100% tuyo"*.

**Mitigación ya ejecutada:** el pipeline se construyó el 17–18 de agosto, en repo personal público, con commits fechados. Es trabajo previo documentado.

**Acción el miércoles**, al inicio, en voz alta y sin filo:
> "En el anexo dice que lo del curso es propiedad de la CSS y en el kit dice que el proyecto es mío. ¿Cómo funciona si alguien llega con trabajo previo propio?"

**Reparto con el equipo:** Saúl trae pipeline y datos (trabajo previo). El equipo construye visualización y narrativa. Así la contaminación de PI se limita a la capa de presentación.

### No tocar: pensiones

El plazo del sistema mixto venció el **18 de agosto** — el día antes del evento. Tema políticamente tóxico, sin acción posible, y la CSS estará en modo defensivo. **No mencionarlo ni como ejemplo.**

Sí se puede usar como *argumento* (la gente guarda screenshots porque no hay historial), nunca como *objeto*.

### Percepción de fiscalización

Ver el encuadre y el cierre en la sección 2.

### Prometer de más

> "Esto no sustituye contratar médicos; hace visible dónde el sistema falla para que la decisión se tome con datos."

---

## 8. Lo que falta

### Crítico antes del miércoles

| # | Tarea | Estado |
|---|---|---|
| 1 | **Agregador** — JSON derivado que alimente la interfaz | pendiente |
| 2 | **Interfaz** — 3 pantallas, publicada en Vercel | pendiente |
| 3 | Verificar la hipótesis del stock residual (hallazgo B) | pendiente |
| 4 | Guion del pitch (7 min) + página de metodología y límites | pendiente |
| 5 | Ensayar el corte de conexión | pendiente |
| 6 | Agregar `captura-lom.js` al workflow (1×/día) | pendiente |
| 7 | Laptop cargada + cargador | miércoles |

### Interfaz — especificación mínima

**Tres pantallas, nada más.** Nada de mapas, dashboards de doce gráficas, ni chatbot.

1. **Portada** — qué es, contador de capturas en vivo, **fecha de la primera captura bien visible** (esa fecha es el activo)
2. **Un medicamento** — línea de tiempo de las capturas: dónde había, dónde no, cómo cambió
3. **Metodología y límites** — qué se captura, cada cuánto, qué no se puede saber, atribución de fuente

**Sobre la marca:**
- **NO usar el logo de la CSS.** Implica aval que no existe y destruye el argumento de verificación independiente.
- Atribución en texto: *"Fuente: Mi Farma Digital — Caja de Seguro Social de Panamá. Datos capturados de forma automatizada. Este sitio no está afiliado a la CSS."*
- Firma: **"por Saúl Santos"**. NO poner Santhoris (aislamiento decidido).
- Datos falsos durante desarrollo: banner visible de "datos de ejemplo".
- **Distinguir "no disponible" de "no capturado".** Un fallo de scraping no es un desabastecimiento. Si la interfaz los confunde, el dato miente.

### Después del evento (jueves)

- Postmortem público (como el de FactureP) — **eso sí es tuyo**
- Restaurar `~/.zshrc` con la llave nueva de DeepSeek
- Borrar `token github.txt` del escritorio, borrar `~/.git-credentials`, revocar token
- Considerar TPM2 con `systemd-cryptenroll`

---

## 9. Comandos de referencia

```bash
cd ~/farma-historico

# SIEMPRE antes de trabajar (Actions commitea cada 3h)
git pull --rebase

# Capturar
node captura.js                    # los 14 medicamentos
node captura-lom.js                # Lista Oficial (1×/día, se protege solo)
node captura-lom.js --forzar       # forzar re-descarga

# Reprocesar todo el crudo con el parser actual
node reparse.js

# Subir
git add -A && git commit -m "..." && git push

# Revisar última captura
cat data/2026-08-18/*/_resumen.json | tail -40
python3 -c "import json,glob;print(json.load(open(sorted(glob.glob('data/*/*/paracetamol-500.json'))[-1]))['calidad'])"
```

**Entorno:** zsh (`~/.zshrc`) · Wayland · Node en `/home/sauul/.local/bin/node` · `Fn+F12` para devtools · `EDITOR=nano`

**Notas:** `git config --global core.pager cat` ya aplicado (evita que el paginador atrape la terminal). Playwright avisa que EndeavourOS no está soportado oficialmente y baja el build de Ubuntu — funciona bien.

---

## 10. Cronograma restante

**Martes 18**
- Madrugada/mañana: agregador + interfaz
- Tarde: **URL pública viva con datos reales** (compuerta: si a las 6pm no hay URL, publicar la versión fea)
- Noche: guion, página de límites, ensayo del corte de conexión

**Miércoles 19**
- Antes: laptop cargada + cargador
- 4:00pm: pregunta de PI al inicio
- Primera hora: publicar v1 vivo (llegar con la URL ya hecha)
- Buscar aliados de perfil clínico o logístico, no otro ingeniero de sistemas

**Jueves 20**
- Postmortem público
- Limpieza de credenciales

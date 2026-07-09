#!/usr/bin/env node
/**
 * test_detector.js — Suite de tests del Detector de Prompt Injection
 *
 * Qué verifica:
 *   1. Que el array PATTERNS de index.html se pueda extraer y evaluar
 *      (todas las regex compilan en el mismo motor JS que usa el navegador).
 *   2. Sincronización CSV ↔ EXAMPLE_DB (misma cantidad y mismos textos).
 *   3. Cobertura de la capa regex: cuántos ejemplos del CSV son detectados
 *      por al menos una regla (por categoría). Los que no, quedan cubiertos
 *      por la capa de similitud (matchean consigo mismos por construcción).
 *   4. Falsos positivos: un corpus de textos benignos no debe disparar
 *      reglas con fpRisk 'low' (las de alta confianza).
 *
 * Uso:
 *   node test_detector.js            # reporte completo
 *   node test_detector.js --quiet    # solo resumen y fallos
 *
 * Sin dependencias — solo Node >= 16.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { types } = require("util");

const QUIET = process.argv.includes("--quiet");
const BASE = __dirname;
const HTML_PATH = path.join(BASE, "index.html");
const CSV_PATH = path.join(BASE, "prompt_injection_ejemplos.csv");

let failures = 0;
let warnings = 0;

function fail(msg) { failures++; console.error("  ✗ FAIL: " + msg); }
function warn(msg) { warnings++; if (!QUIET) console.warn("  ⚠ WARN: " + msg); }
function ok(msg)   { if (!QUIET) console.log("  ✓ " + msg); }
function section(t){ console.log("\n── " + t + " " + "─".repeat(Math.max(0, 60 - t.length))); }

/* ── Extracción de PATTERNS desde index.html ─────────────────────────── */

function extractPatterns(html) {
  const startTag = "const PATTERNS = [";
  const start = html.indexOf(startTag);
  if (start === -1) throw new Error("no se encontró 'const PATTERNS = [' en index.html");
  const end = html.indexOf("\n];", start);
  if (end === -1) throw new Error("no se encontró el cierre '];' de PATTERNS");
  const code = html.slice(start, end + 3) + "\nPATTERNS;";
  // Sandbox sin DOM: si alguna regla dependiera de document/window, falla acá.
  return vm.runInNewContext(code, {}, { filename: "PATTERNS(index.html)" });
}

function extractExampleDb(html) {
  const startMarker = "/* BUILD:EXAMPLE_DB_START */";
  const endMarker = "/* BUILD:EXAMPLE_DB_END */";
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) throw new Error("marcadores BUILD no encontrados");
  const code = html.slice(start + startMarker.length, end) + "\nEXAMPLE_DB;";
  return vm.runInNewContext(code, {}, { filename: "EXAMPLE_DB(index.html)" });
}

/* ── Parser CSV mínimo (maneja comillas y saltos de línea embebidos) ─── */

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(f => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some(f => f.trim() !== "")) rows.push(row); }
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}

/* ── Motor de matching (replica el exec-loop del index.html) ─────────── */

function matchRule(rule, text) {
  const re = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : rule.regex.flags + "g");
  let m, count = 0, guard = 0;
  while ((m = re.exec(text)) !== null) {
    if (++guard > 500) break;                       // anti-loop
    if (m.index === re.lastIndex) re.lastIndex++;   // regex de ancho cero
    if (rule.postFilter && !rule.postFilter(m[0], text, m.index)) continue;
    count++;
  }
  return count;
}

function scan(patterns, text) {
  const hits = [];
  for (const cat of patterns)
    for (const rule of cat.rules)
      if (matchRule(rule, text) > 0)
        hits.push({ category: cat.category, rule: rule.name, fpRisk: rule.fpRisk || "medium" });
  return hits;
}

/* ── Corpus benigno ──────────────────────────────────────────────────── */

const BENIGN_CORPUS = [
  { name: "receta de cocina", text: "Mezclá la harina con el azúcar y agregá los huevos. Horneá 40 minutos a 180 grados. Dejá enfriar antes de desmoldar y serví con crema batida." },
  { name: "noticia", text: "El banco central anunció ayer una baja de la tasa de interés de referencia. Los analistas esperan que la medida impulse el crédito al consumo durante el segundo semestre del año." },
  { name: "email laboral", text: "Hola equipo, les recuerdo que la reunión de mañana se pasa a las 15hs. Por favor confirmen asistencia y traigan el informe de avance del proyecto. Saludos, Laura." },
  { name: "código JS común", text: "const items = data.filter(x => x.active).map(x => x.name); console.log(items.join(', ')); // TODO: refactorizar este bloque" },
  { name: "HTML con script CDN", text: '<html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script></head><body><p>Bienvenido al sitio</p></body></html>' },
  { name: "img lazy-loading", text: '<img src="foto.jpg" style="opacity:0" class="lazyload" alt="paisaje de montaña al atardecer">' },
  { name: "config JSON", text: '{"name": "mi-app", "version": "1.0.3", "scripts": {"build": "webpack --mode production", "test": "jest --coverage"}}' },
  { name: "CV / currículum", text: "Desarrollador full-stack con 8 años de experiencia en React y Node.js. Lideré un equipo de 5 personas y coordiné la migración a microservicios de la plataforma de pagos." },
  { name: "manual de usuario", text: "Para restablecer la contraseña, hacé clic en 'Olvidé mi contraseña' en la pantalla de inicio de sesión y seguí las instrucciones que llegan por correo." },
  { name: "texto académico", text: "El estudio analiza la evolución demográfica de la región pampeana entre 1950 y 2010, con especial atención a los flujos migratorios internos y su impacto en la urbanización." },
  { name: "data URI de imagen", text: '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="pixel">' },
  { name: "conversación casual", text: "¿Viste el partido de anoche? No lo podía creer, lo dieron vuelta en los últimos cinco minutos. Igual el arquero de ellos atajó todo, fue el mejor de la cancha." },
  { name: "documentación técnica", text: "The configuration file accepts the following keys: timeout (in seconds), retries (integer), and log_level (one of debug, info, warning, error). Defaults are applied when a key is missing." },
  { name: "reseña de producto", text: "La batería dura fácil dos días con uso normal. La cámara es correcta de día pero de noche mete bastante ruido. Por el precio, está muy bien. Se la recomendaría a cualquiera." },
];

/* ── Tests ───────────────────────────────────────────────────────────── */

function main() {
  console.log("=== test_detector.js — Suite de tests ===");

  /* 1. Extracción y compilación */
  section("1. Extracción de PATTERNS y EXAMPLE_DB");
  const html = fs.readFileSync(HTML_PATH, "utf-8");
  let patterns, exampleDb;
  try {
    patterns = extractPatterns(html);
    const nRules = patterns.reduce((a, c) => a + c.rules.length, 0);
    ok(`PATTERNS: ${patterns.length} categorías, ${nRules} reglas regex — todas compilan`);
  } catch (e) {
    fail("no se pudo evaluar PATTERNS: " + e.message);
    process.exit(1);
  }
  try {
    exampleDb = extractExampleDb(html);
    ok(`EXAMPLE_DB: ${exampleDb.length} entradas`);
  } catch (e) {
    fail("no se pudo evaluar EXAMPLE_DB: " + e.message);
    process.exit(1);
  }
  for (const cat of patterns) {
    if (!cat.category || !cat.severity || !Array.isArray(cat.rules) || !cat.rules.length)
      fail(`categoría malformada: ${JSON.stringify(cat.category)}`);
    for (const rule of cat.rules) {
      // types.isRegExp: las RegExp del sandbox vm son de otro realm — instanceof no sirve
      if (!types.isRegExp(rule.regex)) fail(`regla sin regex: ${cat.category} / ${rule.name}`);
      if (!rule.name) warn(`regla sin nombre en ${cat.category}`);
    }
  }

  /* 2. Sincronización CSV ↔ EXAMPLE_DB */
  section("2. Sincronización CSV ↔ EXAMPLE_DB");
  const csvRows = parseCsv(fs.readFileSync(CSV_PATH, "utf-8")).filter(r => r.texto);
  if (csvRows.length !== exampleDb.length)
    fail(`CSV tiene ${csvRows.length} ejemplos pero EXAMPLE_DB tiene ${exampleDb.length} — correr: python build.py`);
  else ok(`${csvRows.length} ejemplos en ambos lados`);
  const dbTexts = new Set(exampleDb.map(e => e.t));
  const missing = csvRows.filter(r => !dbTexts.has(r.texto));
  if (missing.length)
    fail(`${missing.length} textos del CSV no están en EXAMPLE_DB (ej: "${missing[0].texto.slice(0, 60)}…") — correr: python build.py`);
  else ok("todos los textos del CSV están en EXAMPLE_DB");

  /* 3. Cobertura de la capa regex sobre los ejemplos del CSV */
  section("3. Cobertura regex por categoría (el resto lo cubre similitud)");
  const patternCats = new Set(patterns.map(p => p.category));
  const byCat = {};
  for (const row of csvRows) (byCat[row.categoria] ||= []).push(row);
  let totalDetected = 0;
  const catReport = [];
  for (const [cat, rows] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
    let detected = 0;
    for (const row of rows) if (scan(patterns, row.texto).length > 0) detected++;
    totalDetected += detected;
    const pct = ((detected / rows.length) * 100).toFixed(0);
    catReport.push({ cat, detected, total: rows.length, pct, hasRegex: patternCats.has(cat) });
  }
  for (const r of catReport) {
    const line = `${r.cat}: ${r.detected}/${r.total} (${r.pct}%)${r.hasRegex ? "" : " [sin reglas propias]"}`;
    if (!QUIET) console.log("    " + line);
    if (r.hasRegex && r.detected === 0)
      fail(`la categoría "${r.cat}" tiene reglas regex pero no detecta NINGUNO de sus ${r.total} ejemplos`);
  }
  const globalPct = ((totalDetected / csvRows.length) * 100).toFixed(1);
  ok(`cobertura regex global: ${totalDetected}/${csvRows.length} (${globalPct}%) — lo no cubierto lo captura la capa de similitud`);

  /* 4. Falsos positivos sobre corpus benigno */
  section("4. Falsos positivos (corpus benigno, " + BENIGN_CORPUS.length + " textos)");
  for (const sample of BENIGN_CORPUS) {
    const hits = scan(patterns, sample.text);
    const confident = hits.filter(h => h.fpRisk === "low");
    if (confident.length)
      fail(`"${sample.name}" dispara regla de alta confianza: ${confident.map(h => `${h.category} / ${h.rule}`).join("; ")}`);
    else if (hits.length)
      warn(`"${sample.name}" dispara ${hits.length} regla(s) de baja confianza: ${hits.map(h => h.rule).join("; ")}`);
    else ok(`"${sample.name}" — limpio`);
  }

  /* Resumen */
  section("Resumen");
  console.log(`  Fallos: ${failures} · Avisos: ${warnings}`);
  console.log(failures === 0 ? "  ✅ TODOS LOS TESTS PASAN" : "  ❌ HAY FALLOS");
  process.exit(failures === 0 ? 0 : 1);
}

main();

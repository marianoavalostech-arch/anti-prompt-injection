# Auditoría de Código — Detector de Prompt Injection v2.6
**Fecha:** 2026-06-05  
**Auditor:** Claude (revisión integral como equipo de desarrollo)  
**Alcance:** index.html, build.py, add_sri.py, install_hooks.py, hooks/pre-commit, prompt_injection_ejemplos.csv, .gitignore

---

## Resumen Ejecutivo

El proyecto está en muy buen estado. La arquitectura es sólida, el pipeline CSV→EXAMPLE_DB funciona correctamente, la lógica de detección es robusta y el manejo de DOM es seguro contra XSS. Se encontraron **3 bugs reales** (uno de mediana gravedad, dos leves) y **2 gaps de seguridad** que conviene atender. El resto son mejoras de calidad menor.

**Veredicto: APTO para producción con las correcciones indicadas.**

---

## Hallazgos por Severidad

### 🔴 Alta — Seguridad

#### H1: SRI ausente en los 3 scripts CDN
**Archivo:** `index.html`, líneas 547–549  
**Riesgo:** Supply-chain attack. Si cdnjs.cloudflare.com fuera comprometido, pdf.js, mammoth.js o jszip.js podrían ejecutar código arbitrario en el navegador del usuario sin ninguna verificación de integridad.

```html
<!-- Actual (sin SRI): -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- Correcto (con SRI): -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        integrity="sha384-XXXX..." crossorigin="anonymous"></script>
```

**Solución:** `add_sri.py` ya existe y hace exactamente esto. Ejecutarlo y commitear el resultado:
```bash
python add_sri.py
git add index.html
git commit -m "security: add SRI hashes to CDN scripts"
```

---

### 🟡 Media — Bugs / Correctitud

#### M1: Inconsistencia de versión en el JSON exportado
**Archivo:** `index.html`, función `exportJSON()` (~línea 2485)  
**Descripción:** El badge del header muestra `v2.6` pero el JSON exportado contiene `version: '2.4'`. Todos los informes descargados mienten sobre la versión del tool que los generó.

```javascript
// Actual:
version: '2.4',

// Correcto:
version: '2.6',
```

**Fix:** Actualizar el literal `'2.4'` a `'2.6'` en `exportJSON()`. Para evitar que vuelva a quedar desincronizado, extraer la versión a una constante al tope del script:
```javascript
const APP_VERSION = '2.6';
// ... y luego:
version: APP_VERSION,
```

#### M2: No hay meta CSP (Content-Security-Policy)
**Archivo:** `index.html`, `<head>`  
**Riesgo:** Sin CSP, si existiera una vulnerabilidad XSS residual, el navegador ejecutaría cualquier script inyectado sin restricción.

```html
<!-- Agregar en <head>: -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src https://api.allorigins.win https://corsproxy.io https://api.codetabs.com; object-src 'none';">
```

Nota: `'unsafe-inline'` es necesario porque los estilos y el script están embebidos en el HTML. Si en el futuro se separan a archivos externos, se puede eliminar ese permiso.

---

### 🟢 Baja — Calidad / Mejoras menores

#### L1: Memory leak en `exportJSON()`
**Archivo:** `index.html`, función `exportJSON()` (~línea 2493)  
`URL.createObjectURL(blob)` crea una URL de objeto que nunca se libera con `URL.revokeObjectURL()`. El blob queda en memoria hasta que se recarga la página.

```javascript
// Actual:
anchor.href = URL.createObjectURL(blob);
anchor.download = 'prompt-injection-report.json';
anchor.click();

// Correcto:
const objectUrl = URL.createObjectURL(blob);
anchor.href = objectUrl;
anchor.download = 'prompt-injection-report.json';
anchor.click();
setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
```

#### L2: `continue` en lugar de `break` en `runExampleMatching()`
**Archivo:** `index.html`, función `runExampleMatching()` (~línea 2102)  
Cuando `total >= SIM_MAX`, el inner loop usa `continue` en lugar de `break`, lo que hace que se siga iterando sobre todas las oraciones restantes sin hacer trabajo útil (solo evalúa la condición y la salta).

```javascript
// Actual:
for (const sd of sentData) {
  if (total >= SIM_MAX || !sd.bigrams.size) continue;  // sigue iterando inútilmente

// Correcto:
for (const sd of sentData) {
  if (total >= SIM_MAX) break;  // sale del loop inmediatamente
  if (!sd.bigrams.size) continue;
```

#### L3: 3 categorías del CSV sin reglas regex en PATTERNS
**Descripción:** Las categorías `Ataques a agentes IA`, `Abuso de herramientas` e `Hijacking de razonamiento` fueron agregadas al CSV en v2.5 pero no tienen reglas regex correspondientes en `PATTERNS`. Solo se detectan por la capa de similitud (Jaccard). Esto reduce la cobertura: si el ataque no es suficientemente similar a los ejemplos del CSV, pasará desapercibido.

**Solución:** Agregar bloques de reglas regex para estas 3 categorías en `PATTERNS`. Ejemplo de estructura para `Ataques a agentes IA`:
```javascript
{
  category: 'Ataques a agentes IA',
  severity: 'high',
  icon: '🤖',
  rules: [
    { name: 'Instrucción para agente autónomo', fpRisk: 'low',
      regex: /(?:as\s+an?\s+(?:autonomous\s+)?agent|agent\s+instruction|ai\s+agent[^,]{0,30}(?:authorized|pipeline|override))/gi },
    // ... más reglas
  ],
},
```

#### L4: `htmlToText` regresa `raw` si `doc.body` es null
**Archivo:** `index.html`, función `htmlToText()` (~línea 2564)  
```javascript
return doc.body ? doc.body.innerText || doc.body.textContent : raw;
```
Si el HTML está muy malformado y `DOMParser` no construye un `body`, se devuelve el HTML crudo completo (con scripts, estilos, etc.) al motor de análisis, generando potencialmente cientos de falsos positivos.

**Fix:**
```javascript
return doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';
```

#### L5: `isInCodeBlock()` tiene complejidad O(n) por cada llamada
**Archivo:** `index.html`, función `isInCodeBlock()`  
Usa `.some()` sobre todos los rangos de código por cada coincidencia de patrón. Para documentos grandes con muchos bloques de código y miles de matches, esto puede ser lento (O(matches × codeRanges)).

**Fix sugerido:** Ordenar `codeRanges` por inicio y usar búsqueda binaria, o construir un Set/BitArray de posiciones. Para documentos de tamaño normal (<100KB) el impacto es negligible.

#### L6: Commit messages sin estándar
Los últimos commits tienen mensajes vagos ("se mejoro el codigo", "se arreglo bug en example"). Para un proyecto de seguridad open-source, los mensajes descriptivos importan: permiten entender el historial sin leer el diff.

**Convención sugerida (Conventional Commits):**
```
fix: corregir deduplicación por categoría en análisis de URL
feat: agregar proxies CORS en paralelo con Promise.any
security: agregar hashes SRI a scripts CDN
```

---

## Lo que funciona correctamente ✅

| Componente | Estado | Detalle |
|---|---|---|
| `build.py` — pipeline CSV→HTML | ✅ | 792 ejemplos inyectados correctamente, escritura atómica |
| Sincronización CSV ↔ EXAMPLE_DB | ✅ | 100% sincronizados, verificado programáticamente |
| Sintaxis Python (3 scripts) | ✅ | Sin errores de sintaxis |
| Pre-commit hook | ✅ | Solo ejecuta si el CSV está en staging; detecta Python en Win/Mac/Linux |
| XSS en DOM | ✅ | Todos los datos de usuario pasan por `escapeHtml()` o `.textContent` |
| Proxy fetch con timeout | ✅ | `AbortSignal.timeout(12_000)` en cada fetch |
| Manejo de `AggregateError` | ✅ | `Promise.any()` con detalle de cada error de proxy |
| Guards de concurrencia | ✅ | `_fileAnalyzing` y `_urlAnalyzing` previenen análisis simultáneos |
| `fetchViaProxy` — wrapper allorigins | ✅ | Detecta `contents` vacío y lanza error descriptivo |
| `decodeHTMLEntities` con `textarea` | ✅ | Patrón seguro (textarea no ejecuta scripts) |
| `buildNormalizedView` | ✅ | Maneja pares sustitutos, fullwidth, homóglifos, zero-width correctamente |
| `collectHidden` en DOCX | ✅ | Detecta vanish, color blanco, fuente 0pt, headers y footers |
| `"use strict"` | ✅ | Presente |
| `.gitignore` | ✅ | Cubre __pycache__, *.pyc, .env, *.html.bak, editors |
| `exportJSON` datos | ✅ | No expone la URL ni datos de usuario sin sanitizar |
| Sistema de confianza (confirmed/likely/possible) | ✅ | Lógica coherente con fpRisk y contexto de código |
| Filtro de postFilter (opacity:0, script src, data:image/) | ✅ | Correctamente implementado para reducir FPs en sitios modernos |

---

## Checklist de correcciones prioritarias

- [ ] **[ALTA]** Ejecutar `python add_sri.py` y commitear → fix H1
- [ ] **[MEDIA]** Cambiar `version: '2.4'` a `version: '2.6'` en `exportJSON()` → fix M1
- [ ] **[MEDIA]** Agregar meta CSP en `<head>` → fix M2
- [ ] **[BAJA]** Agregar `setTimeout(() => URL.revokeObjectURL(objectUrl), 100)` en `exportJSON()` → fix L1
- [ ] **[BAJA]** Cambiar `continue` por `break` en inner loop de `runExampleMatching()` → fix L2
- [ ] **[BAJA]** Agregar reglas regex para las 3 categorías CSV-only → fix L3
- [ ] **[BAJA]** Cambiar `raw` por `''` en el fallback de `htmlToText()` → fix L4

---

*Auditoría generada por Claude · Detector de Prompt Injection v2.6 · 2026-06-05*

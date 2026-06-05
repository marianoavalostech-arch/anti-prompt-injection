# Detector de Prompt Injection

Herramienta web para detectar ataques de **prompt injection** en documentos y texto. Funciona 100% en el navegador — ningún dato sale de tu dispositivo.

[![Demo en vivo](https://img.shields.io/badge/demo-live-brightgreen)](https://anti-prompt-injection.netlify.app)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![Sin servidor](https://img.shields.io/badge/sin%20servidor-100%25%20local-purple)](#)
[![Versión](https://img.shields.io/badge/versión-v2.6.0-blue)](#)

---

## Demo

🔗 **[Abrir la herramienta](https://anti-prompt-injection.netlify.app)**

---

## ¿Qué detecta?

| Categoría | Severidad |
|---|---|
| Override de instrucciones (ignora/forget) | 🔴 Alta |
| Manipulación de rol (act as, DAN, jailbreak) | 🔴 Alta |
| Extracción del prompt del sistema | 🔴 Alta |
| Suplantación de autoridad (tags de sistema) | 🔴 Alta |
| Inyección indirecta u oculta (caracteres invisibles, CSS) | 🔴 Alta |
| Exfiltración de datos | 🔴 Alta |
| Desbloqueo de contenido dañino | 🔴 Alta |
| Jailbreaks conocidos (DAN, GODMODE, evil confidant…) | 🔴 Alta |
| Inyección estructurada (JSON/YAML/XML) | 🔴 Alta |
| Ofuscación avanzada (leetspeak, ROT13, texto invertido) | 🔴 Alta |
| Inyección en otros idiomas (FR, DE, PT, IT, ZH, RU, AR, JA, KO…) | 🔴 Alta |
| Indicadores semánticos de control | 🔴 Alta |
| Reformulación semántica (ES) | 🔴 Alta |
| Instrucciones ocultas en documentos (ataques RAG) | 🔴 Alta |
| Ataques a agentes IA (pipelines, herramientas, orquestadores) | 🔴 Alta |
| Abuso de herramientas (email, browser, code exec, DB) | 🔴 Alta |
| Hijacking de razonamiento (cadena de pensamiento) | 🔴 Alta |
| Inyección de código / plantilla | 🟡 Media |
| Contenido codificado sospechoso | 🟡 Media |
| Escape de contexto | 🟡 Media |
| Manipulación de conversación | 🟡 Media |
| Ingeniería social | 🟢 Baja |

## Características

- Analiza **PDF, DOCX, TXT, MD, HTML, JSON, CSV, XML, YAML** y texto pegado
- **Análisis de URL mejorado** — dispara 4 proxies CORS en paralelo (`Promise.any`) y usa el primero que responda (máx. ~12 s en vez de hasta 60 s); extrae solo el texto visible del HTML para reducir ruido; desenvuelve automáticamente respuestas JSON de proxy; mensaje de error descriptivo con causas y solución cuando todos los proxies fallan
- Detecta ofuscación: homóglifos, caracteres de ancho cero, unicode invisible, Base64, URL-encoding, entidades HTML numéricas
- Normaliza el texto antes de escanear para no perder variantes ofuscadas
- **Detección por similitud** — capa adicional que compara el texto contra una base de 578 ejemplos conocidos usando similitud Jaccard sobre bigramas de palabras
- Sistema de **confianza por coincidencia** (Confirmado / Probable / Posible FP) con filtro ocultable
- **Filtros de falsos positivos quirúrgicos** (`postFilter` por regla) para sitios modernos: excluye `<script src=...>` externos y bloques JSON de framework, descarta `data:image/` como MIME inofensivo, ignora `opacity:0` en elementos `<img>` (lazy-loading)
- Puntuación de riesgo 0–100 con nivel (sin riesgo / medio / alto)
- Exporta el informe en **JSON**
- Tema claro / oscuro
- Sin dependencias propias — usa PDF.js y Mammoth via CDN

## Uso

La forma más rápida es usar la [demo en vivo](https://anti-prompt-injection.netlify.app). Para correrlo localmente:

```bash
# Windows
start index.html

# Mac
open index.html

# Linux
xdg-open index.html
```

O con un servidor local mínimo:

```bash
python3 -m http.server 8080
# luego visita http://localhost:8080
```

> **Nota:** La extracción de PDF requiere conexión a internet para cargar el worker de PDF.js desde CDN. Para TXT, DOCX y texto pegado funciona completamente offline.

## Cómo funciona

1. **Extracción** — lee el contenido según el tipo de archivo (PDF.js para PDFs, Mammoth para DOCX, DOMParser para HTML).
2. **Seis vistas de escaneo:**
   - *Original* — texto tal cual.
   - *Normalizado* — elimina caracteres invisibles, reemplaza homóglifos cirílicos/griegos, colapsa espaciado de ofuscación.
   - *Base64* — decodifica blobs Base64 y los escanea por separado.
   - *URL-encoded* — decodifica secuencias `%xx` y las analiza.
   - *HTML entities* — decodifica entidades numéricas (`&#xxx;`) y las analiza.
   - *Similitud* — compara el texto contra `prompt_injection_ejemplos.csv` usando Jaccard sobre bigramas de palabras (umbral ≥30%).
3. **Motor de patrones** — aplica ~82 reglas regex organizadas en 19 categorías por severidad. Cada regla puede definir un `postFilter(matchText, fullText, index)` que descarta coincidencias válidas sintácticamente pero inocentes en contexto (ej. `opacity:0` en `<img>`, `<script src=...>` externos).
4. **Sistema de confianza** — cada coincidencia recibe nivel `confirmed`, `likely` o `possible` según el riesgo de falso positivo de la regla y si la coincidencia cae dentro de un bloque de código o contexto educativo.
5. **Puntuación** — combina cantidad de coincidencias, severidad y nivel de confianza (máx. 100).

## Archivos

| Archivo | Descripción |
|---|---|
| `index.html` | Aplicación completa (todo-en-uno) |
| `prompt_injection_ejemplos.csv` | Fuente de verdad — 578 ejemplos de ataques para la capa de similitud |
| `build.py` | Inyecta el CSV en `index.html` como `EXAMPLE_DB` (lo llama el hook automáticamente) |
| `install_hooks.py` | Instala el pre-commit hook. Ejecutar una vez tras clonar el repo |
| `hooks/pre-commit` | Hook git versionado: corre `build.py` antes de cada commit si el CSV cambió |
| `add_sri.py` | Agrega hashes SRI a los scripts CDN (pdf.js, mammoth.js, jszip.js) |

## Tecnologías

- Vanilla JS (sin frameworks)
- [PDF.js](https://mozilla.github.io/pdf.js/) — extracción de texto en PDFs
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — extracción de texto en DOCX

## Changelog

### v2.6.0 (2026-06-05)
- **Análisis de URL — proxies en paralelo:** los 4 proxies CORS se disparan simultáneamente con `Promise.any()`; gana el primero que responda. Tiempo de descarga máximo: ~12 s (antes hasta 60 s con 5 proxies en cascada).
- **Proxy eliminado:** se quitó `thingproxy.freeboard.io`, que estaba caído y solo sumaba latencia.
- **Helper `fetchViaProxy`:** lógica de descarga extraída a función dedicada. Corrige bug donde `allorigins /get` devolvía `{"contents":""}` (vacío) y la función lo retornaba como si fuera el HTML de la página, causando análisis incorrectos. Ahora detecta el campo `contents` explícitamente y lanza error si está vacío.
- **Guard URL — clicks múltiples:** `_urlAnalyzing` + `btn.disabled` evitan que doble-click o Enter en el input disparen dos análisis en paralelo produciendo alertas duplicadas. El botón se re-habilita siempre via `finally`.
- **Guard archivos — análisis simultáneos:** `_fileAnalyzing` evita que drag-and-drop y click simultáneos procesen dos archivos a la vez.
- **PDF escaneado sin texto:** si `extractText` devuelve vacío (PDF de imágenes sin capa de texto), se muestra mensaje explicativo en lugar de resultados en blanco.
- **Mensajes de error en archivos:** errores diferenciados según tipo de archivo y causa (CDN no cargado, PDF dañado, DOCX protegido con contraseña, etc.). `resetUI` se llama antes del `alert` para no dejar el spinner visible.
- **Errores URL más descriptivos:** cuando todos los proxies fallan, el mensaje muestra el motivo exacto de cada uno (proveniente del `AggregateError`).

### v2.5.0 (2026-06-05)
- **Dataset ampliado:** `prompt_injection_ejemplos.csv` pasa de 298 a 578 ejemplos (+280 entradas). Se agregaron 3 categorías nuevas: **Ataques a agentes IA**, **Abuso de herramientas** e **Hijacking de razonamiento**. Las categorías existentes reciben entre 7 y 20 variantes adicionales, incluyendo nuevos idiomas (Hindi, Turco, Indonesio, Polaco, Sueco, Ucraniano, Hebreo, Vietnamita, Checo), técnicas de codificación adicionales (hexadecimal, binario, Morse, cifrado César), más jailbreaks nombrados (STAN, UCAR, AIM, DUDE, LUCIFER, ORION, VOID, ZEUS), variantes de ofuscación unicode extendidas y más ataques semánticos.
- **`build.py` (nuevo):** script de build que lee el CSV e inyecta el array `EXAMPLE_DB` en `index.html` entre marcadores `BUILD:EXAMPLE_DB_START / END`. El CSV es ahora la única fuente de verdad; el bloque hardcodeado en el HTML se genera automáticamente. Flujo: editar CSV → `python build.py` → commit.
- **EXAMPLE_DB de `index.html`** sincronizada al 100% con el CSV (578 entradas).

### v2.4.1 (2026-06-05)
- **Bug fix:** corregida deduplicación en el análisis de URL — la comparación `rr.text === r.text` comparaba `undefined === undefined` y descartaba todos los hallazgos del texto visible cuando existían hallazgos en el HTML crudo. Ahora se deduplica correctamente por `category`.
- **Bug fix:** el spinner de carga no se pintaba en la pestaña "Pegar texto" porque `renderResults` se llamaba síncronamente justo después de `showLoading()`. Se añadió `setTimeout(..., 0)` para ceder el hilo al navegador antes de procesar.
- **Mejora `add_sri.py`:** se agregó `jszip.min.js` a la lista de scripts CDN con SRI (antes solo cubría pdf.js y mammoth.js).
- **Mejora legibilidad:** la regex de tildes en `simTokenize` ahora usa `[̀-ͯ]` en lugar de caracteres combinantes literales invisibles.

## Limitaciones

- Es una herramienta **heurística**. Puede haber falsos positivos y falsos negativos.
- No cubre ataques completamente nuevos o muy personalizados.
- La capa de similitud usa coincidencia léxica — no detecta paráfrasis semánticamente equivalentes pero léxicamente distintas.
- El modo URL usa 4 proxies CORS públicos en paralelo — puede fallar con sitios que requieran login, estén detrás de firewall, o bloqueen proxies activamente. En ese caso, pegá el contenido en la pestaña "Texto".

## Contribuir

Las contribuciones son bienvenidas. Podés:

- Agregar ejemplos al CSV `prompt_injection_ejemplos.csv` (columnas: `texto, categoria, severidad, confianza, variante, notas`) — el hook los inyecta en `index.html` automáticamente al hacer commit
- Agregar nuevas reglas de detección en el array `PATTERNS` dentro de `index.html`
- Reportar falsos positivos o negativos abriendo un [issue](../../issues)
- Proponer mejoras vía pull request

### Setup para contribuidores

```bash
git clone https://github.com/marianoavalostech-arch/Anti-Prompt-Injection
cd anti-prompt-injection
python install_hooks.py   # instala el pre-commit hook (una sola vez)
```

A partir de ahí, editar el CSV y hacer commit es suficiente — `build.py` corre solo.

## Licencia

MIT © 2026 Mariano Avalos

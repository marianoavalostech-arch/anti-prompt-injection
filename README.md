# Detector de Prompt Injection

Herramienta web para detectar ataques de **prompt injection** en documentos y texto. Funciona 100% en el navegador — ningún dato sale de tu dispositivo.

[![Demo en vivo](https://img.shields.io/badge/demo-live-brightgreen)](https://anti-prompt-injection.netlify.app)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![Sin servidor](https://img.shields.io/badge/sin%20servidor-100%25%20local-purple)](#)
[![Versión](https://img.shields.io/badge/versión-v2.4-blue)](#)

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
| Inyección de código / plantilla | 🟡 Media |
| Contenido codificado sospechoso | 🟡 Media |
| Escape de contexto | 🟡 Media |
| Manipulación de conversación | 🟡 Media |
| Ingeniería social | 🟢 Baja |

## Características

- Analiza **PDF, DOCX, TXT, MD, HTML, JSON, CSV, XML, YAML** y texto pegado
- **Análisis de URL mejorado** — intenta 4 proxies CORS en cascada con progreso visible; extrae solo el texto visible del HTML para reducir ruido; desenvuelve automáticamente respuestas JSON de proxy; mensaje de error descriptivo con causas y solución cuando todos los proxies fallan
- Detecta ofuscación: homóglifos, caracteres de ancho cero, unicode invisible, Base64, URL-encoding, entidades HTML numéricas
- Normaliza el texto antes de escanear para no perder variantes ofuscadas
- **Detección por similitud** — capa adicional que compara el texto contra una base de 298 ejemplos conocidos usando similitud Jaccard sobre bigramas de palabras
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
| `add_sri.py` | Agrega hashes SRI a los scripts CDN (pdf.js, mammoth.js, jszip.js) |
| `prompt_injection_ejemplos.csv` | Base de 298 ejemplos de ataques para la capa de similitud |

## Tecnologías

- Vanilla JS (sin frameworks)
- [PDF.js](https://mozilla.github.io/pdf.js/) — extracción de texto en PDFs
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — extracción de texto en DOCX

## Changelog

### v2.4.1 (2026-06-05)
- **Bug fix:** corregida deduplicación en el análisis de URL — la comparación `rr.text === r.text` comparaba `undefined === undefined` y descartaba todos los hallazgos del texto visible cuando existían hallazgos en el HTML crudo. Ahora se deduplica correctamente por `category`.
- **Bug fix:** el spinner de carga no se pintaba en la pestaña "Pegar texto" porque `renderResults` se llamaba síncronamente justo después de `showLoading()`. Se añadió `setTimeout(..., 0)` para ceder el hilo al navegador antes de procesar.
- **Mejora `add_sri.py`:** se agregó `jszip.min.js` a la lista de scripts CDN con SRI (antes solo cubría pdf.js y mammoth.js).
- **Mejora legibilidad:** la regex de tildes en `simTokenize` ahora usa `[̀-ͯ]` en lugar de caracteres combinantes literales invisibles.

## Limitaciones

- Es una herramienta **heurística**. Puede haber falsos positivos y falsos negativos.
- No cubre ataques completamente nuevos o muy personalizados.
- La capa de similitud usa coincidencia léxica — no detecta paráfrasis semánticamente equivalentes pero léxicamente distintas.
- El modo URL usa 4 proxies CORS públicos en cascada — puede fallar con sitios que requieran login, estén detrás de firewall, o bloqueen proxies activamente. En ese caso, pegá el contenido en la pestaña "Texto".

## Contribuir

Las contribuciones son bienvenidas. Podés:

- Agregar nuevas reglas de detección en el array `PATTERNS` dentro de `index.html`
- Agregar ejemplos al CSV `prompt_injection_ejemplos.csv` (columnas: `texto, categoria, severidad, confianza, variante, notas`)
- Reportar falsos positivos o negativos abriendo un [issue](../../issues)
- Proponer mejoras vía pull request

## Licencia

MIT © 2026 Mariano Avalos

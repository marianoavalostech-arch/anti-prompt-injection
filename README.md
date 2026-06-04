# Detector de Prompt Injection

Herramienta web para detectar ataques de **prompt injection** en documentos y texto. Funciona 100% en el navegador — ningún dato sale de tu dispositivo.

[![Demo en vivo](https://img.shields.io/badge/demo-live-brightgreen)](https://anti-prompt-injection.netlify.app)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![Sin servidor](https://img.shields.io/badge/sin%20servidor-100%25%20local-purple)](#)

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
| Inyección de código / plantilla | 🟡 Media |
| Contenido codificado en Base64 sospechoso | 🟡 Media |
| Escape de contexto | 🟡 Media |
| Ingeniería social | 🟢 Baja |

## Características

- Analiza **PDF, DOCX, TXT, MD, HTML** y texto pegado
- Soporte para **URLs** via proxy CORS con reintentos automáticos
- Detecta ofuscación: homóglifos, caracteres de ancho cero, unicode invisible, Base64
- Normaliza el texto antes de escanear para no perder variantes ofuscadas
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
2. **Tres vistas de escaneo:**
   - *Original* — texto tal cual.
   - *Normalizado* — elimina caracteres invisibles, reemplaza homóglifos cirílicos/griegos, colapsa espaciado de ofuscación.
   - *Base64* — decodifica blobs Base64 y los escanea por separado.
3. **Motor de patrones** — aplica ~50 reglas regex organizadas por categoría y severidad.
4. **Puntuación** — combina cantidad de coincidencias, severidad y presencia de ofuscación (máx. 100).

## Tecnologías

- Vanilla JS (sin frameworks)
- [PDF.js](https://mozilla.github.io/pdf.js/) — extracción de texto en PDFs
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — extracción de texto en DOCX

## Limitaciones

- Es una herramienta **heurística basada en patrones**. Puede haber falsos positivos y falsos negativos.
- No cubre ataques completamente nuevos o muy personalizados.
- El modo URL depende de proxies CORS públicos — puede fallar con sitios protegidos.

## Contribuir

Las contribuciones son bienvenidas. Podés:

- Agregar nuevas reglas de detección en el array `PATTERNS` dentro de `index.html`
- Reportar falsos positivos o negativos abriendo un [issue](../../issues)
- Proponer mejoras vía pull request

## Licencia

MIT © 2026 Mariano Avalos

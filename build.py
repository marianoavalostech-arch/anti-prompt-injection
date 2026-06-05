#!/usr/bin/env python3
"""
build.py — genera el EXAMPLE_DB de index.html a partir de prompt_injection_ejemplos.csv

Uso:
    python build.py

El script lee el CSV, construye el array JS y lo inyecta en index.html entre los
marcadores BUILD:EXAMPLE_DB_START / BUILD:EXAMPLE_DB_END.
Ejecutarlo cada vez que se modifique el CSV.
"""

import csv
import json
import sys
import tempfile
import os
from pathlib import Path

BASE_DIR  = Path(__file__).parent
CSV_PATH  = BASE_DIR / "prompt_injection_ejemplos.csv"
HTML_PATH = BASE_DIR / "index.html"

START_MARKER = "/* BUILD:EXAMPLE_DB_START */"
END_MARKER   = "/* BUILD:EXAMPLE_DB_END */"

REQUIRED_COLS = {"texto", "categoria", "severidad", "confianza"}


def load_examples(csv_path: Path) -> list[dict]:
    examples = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        # Validar que existan todas las columnas requeridas
        missing_cols = REQUIRED_COLS - set(reader.fieldnames or [])
        if missing_cols:
            print(f"ERROR: columnas faltantes en CSV: {missing_cols}", file=sys.stderr)
            sys.exit(1)

        for i, row in enumerate(reader, 2):  # 2 = primera fila de datos
            if not row.get("texto", "").strip():
                continue
            empty_fields = [k for k in ("categoria", "severidad", "confianza")
                            if not row.get(k, "").strip()]
            if empty_fields:
                print(f"  AVISO fila {i}: campos vacíos {empty_fields} — omitida")
                continue
            examples.append({
                "t": row["texto"],
                "c": row["categoria"],
                "s": row["severidad"],
                "q": row["confianza"],
            })
    return examples


def build_js_block(examples: list[dict]) -> str:
    lines = [START_MARKER, "const EXAMPLE_DB = ["]
    for ex in examples:
        # json.dumps garantiza escape correcto de comillas, backslashes, etc.
        t = json.dumps(ex["t"], ensure_ascii=False)
        c = json.dumps(ex["c"], ensure_ascii=False)
        s = json.dumps(ex["s"], ensure_ascii=False)
        q = json.dumps(ex["q"], ensure_ascii=False)
        lines.append(f'  {{"t": {t}, "c": {c}, "s": {s}, "q": {q}}},')
    lines.append("];")
    lines.append(END_MARKER)
    return "\n".join(lines)


def inject(html_path: Path, js_block: str) -> None:
    content = html_path.read_text(encoding="utf-8")

    if START_MARKER not in content or END_MARKER not in content:
        print("ERROR: marcadores BUILD no encontrados en index.html", file=sys.stderr)
        print("  Asegurate de que el archivo contenga:", file=sys.stderr)
        print(f"  {START_MARKER}", file=sys.stderr)
        print(f"  {END_MARKER}", file=sys.stderr)
        sys.exit(1)

    start = content.index(START_MARKER)
    end   = content.index(END_MARKER) + len(END_MARKER)

    new_content = content[:start] + js_block + content[end:]

    # Escritura atómica: escribir en temp y renombrar para evitar corrupción
    tmp_path = html_path.with_suffix(".html.tmp")
    try:
        tmp_path.write_text(new_content, encoding="utf-8")
        tmp_path.replace(html_path)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


def main() -> None:
    print(f"Leyendo {CSV_PATH.name} …")
    examples = load_examples(CSV_PATH)
    print(f"  {len(examples)} ejemplos cargados.")

    js_block = build_js_block(examples)

    print(f"Inyectando en {HTML_PATH.name} …")
    inject(HTML_PATH, js_block)

    print(f"  EXAMPLE_DB en index.html: {len(examples)} entradas.")
    print("Listo.")


if __name__ == "__main__":
    main()

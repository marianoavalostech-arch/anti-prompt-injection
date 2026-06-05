"""
add_sri.py — Agrega SRI (Subresource Integrity) al index.html

Qué hace:
  1. Descarga pdf.js y mammoth.js desde cdnjs
  2. Calcula el hash SHA-384 de cada archivo
  3. Inserta integrity= y crossorigin= en las etiquetas <script>

Cómo correrlo:
  python add_sri.py

Requisitos: Python 3.6+ con urllib (incluido en la biblioteca estándar, sin pip)
"""

import urllib.request
import hashlib
import base64
import re
import shutil
from pathlib import Path

CDN_SCRIPTS = [
    {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        "tag": 'src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"',
    },
    {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
        "tag": 'src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"',
    },
    {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
        "tag": 'src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"',
    },
]

HTML_FILE = Path(__file__).parent / "index.html"


def sha384_b64(data: bytes) -> str:
    digest = hashlib.sha384(data).digest()
    return "sha384-" + base64.b64encode(digest).decode()


def download(url: str) -> bytes:
    print(f"  Descargando {url.split('/')[-1]} ...", end=" ", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    print(f"{len(data):,} bytes")
    return data


def patch_html(html: str, tag_snippet: str, integrity: str) -> str:
    """
    Busca la etiqueta <script src="..."> y le agrega integrity= crossorigin=
    si no los tiene ya.
    """
    # Patron: <script src="...CDN...">  (con o sin atributos existentes)
    pattern = re.compile(
        r'(<script\s[^>]*' + re.escape(tag_snippet) + r'[^>]*?)(\s*>)',
        re.IGNORECASE,
    )

    def replacer(m):
        attrs = m.group(1)
        close = m.group(2)
        if "integrity=" in attrs:
            # Ya tiene SRI — actualizar el hash
            attrs = re.sub(r'integrity="[^"]*"', f'integrity="{integrity}"', attrs)
        else:
            attrs += f' integrity="{integrity}" crossorigin="anonymous"'
        return attrs + close

    new_html, n = pattern.subn(replacer, html)
    if n == 0:
        print(f"  AVISO: no se encontró la etiqueta para {tag_snippet[:60]}")
    else:
        print(f"  Parcheado ({n} coincidencia/s)")
    return new_html


def main():
    print("=== add_sri.py — Agrega SRI a los CDN de index.html ===\n")

    if not HTML_FILE.exists():
        print(f"ERROR: no se encontró {HTML_FILE}")
        return

    # Backup
    backup = HTML_FILE.with_suffix(".html.bak")
    shutil.copy2(HTML_FILE, backup)
    print(f"Backup guardado en {backup.name}\n")

    html = HTML_FILE.read_text(encoding="utf-8")

    for script in CDN_SCRIPTS:
        print(f"Procesando: {script['url'].split('/')[-1]}")
        try:
            data = download(script["url"])
            integrity = sha384_b64(data)
            print(f"  Hash: {integrity}")
            html = patch_html(html, script["tag"], integrity)
        except Exception as e:
            print(f"  ERROR: {e}")
            print("  Saltando este archivo.")
        print()

    HTML_FILE.write_text(html, encoding="utf-8")
    print(f"index.html actualizado correctamente.")
    print("\nPara verificar, buscá 'integrity=' en el index.html.")


if __name__ == "__main__":
    main()

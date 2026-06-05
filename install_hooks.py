#!/usr/bin/env python3
"""
install_hooks.py — instala el pre-commit hook en .git/hooks/

Ejecutar una vez tras clonar el repositorio:
    python install_hooks.py
"""

import os, shutil, stat, sys
from pathlib import Path

BASE_DIR  = Path(__file__).parent
HOOK_SRC  = BASE_DIR / "hooks" / "pre-commit"
HOOK_DEST = BASE_DIR / ".git" / "hooks" / "pre-commit"

if not (BASE_DIR / ".git").exists():
    print("ERROR: no se encontró .git/ — ejecutá este script desde la raíz del repo.")
    sys.exit(1)

HOOK_DEST.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(HOOK_SRC, HOOK_DEST)
HOOK_DEST.chmod(HOOK_DEST.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
print(f"Hook instalado en {HOOK_DEST}")

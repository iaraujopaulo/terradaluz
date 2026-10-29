#!/usr/bin/env python3
"""Copia os arquivos de marca do Terra da Luz (ícones e logotipos) por cima do
código-fonte do Chromium. Chamado pelo build.py depois dos patches.

Uso: aplicar_overlay.py <pasta-src-do-chromium>
"""
import shutil
import sys
from pathlib import Path

overlay = Path(__file__).resolve().parent / "overlay"
src = Path(sys.argv[1])
if not (src / "chrome").is_dir():
    sys.exit(f"{src} não é a pasta src do Chromium")

n = 0
for arquivo in overlay.rglob("*"):
    if arquivo.is_file():
        destino = src / arquivo.relative_to(overlay)
        if not destino.parent.is_dir():
            print(f"aviso: pasta inexistente no Chromium, ignorando {destino}")
            continue
        shutil.copy2(arquivo, destino)
        n += 1
print(f"Terra da Luz: {n} arquivos de marca aplicados")

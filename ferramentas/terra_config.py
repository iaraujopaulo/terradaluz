#!/usr/bin/env python3
"""Lê o terra.config.json e completa o que está em "automático".

Quando "repositorio" ou "urlPublica" estão como "auto" (ou ainda com
SEU-USUARIO), eles são descobertos sozinhos a partir do repositório do GitHub
em que o GitHub Actions está rodando (variável GITHUB_REPOSITORY) ou do
endereço do git local. Assim ninguém precisa editar o arquivo à mão.

Uso no terminal:  python3 ferramentas/terra_config.py urlPublica
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _repositorio_detectado():
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if repo:
        return repo
    try:
        url = subprocess.run(["git", "-C", str(RAIZ), "remote", "get-url", "origin"],
                             capture_output=True, text=True, check=True).stdout.strip()
        m = re.search(r"github\.com[:/]([^/]+/[^/]+?)(\.git)?$", url)
        if m:
            return m.group(1)
    except Exception:
        pass
    return ""


def carregar():
    cfg = json.loads((RAIZ / "terra.config.json").read_text(encoding="utf-8"))
    repo = cfg.get("repositorio", "auto")
    if repo in ("", "auto") or "SEU-USUARIO" in repo:
        repo = _repositorio_detectado()
    if not repo:
        sys.exit("Não consegui descobrir o repositório do GitHub. Rode pelo GitHub Actions "
                 "ou escreva \"dono/nome\" em \"repositorio\" no terra.config.json.")
    cfg["repositorio"] = repo
    url = cfg.get("urlPublica", "auto")
    if url in ("", "auto") or "SEU-USUARIO" in url:
        dono, nome = repo.split("/", 1)
        url = f"https://{dono.lower()}.github.io/{nome}/"
    cfg["urlPublica"] = url.rstrip("/") + "/"
    return cfg


if __name__ == "__main__":
    c = carregar()
    print(c[sys.argv[1]] if len(sys.argv) > 1 else json.dumps(c, indent=2, ensure_ascii=False))

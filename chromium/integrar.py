#!/usr/bin/env python3
"""Prepara uma cópia do ungoogled-chromium de uma plataforma para compilar o
Terra da Luz.

Uso (o GitHub Actions faz isso sozinho):

    python chromium/integrar.py <pasta> --plataforma windows   # ungoogled-chromium-windows
    python chromium/integrar.py <pasta> --plataforma linux     # ungoogled-chromium-portablelinux
    python chromium/integrar.py <pasta> --plataforma macos     # ungoogled-chromium-macos

O que este script faz:
  1. copia os patches do Terra da Luz e os coloca no fim da lista de patches;
  2. acrescenta as opções de compilação do Terra da Luz (flags.terra.gn);
  3. faz o script de compilação aplicar a marca (nome e ícones) logo depois
     dos patches.
Pode ser executado mais de uma vez sem duplicar nada.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
MARCADOR = "# >>> Terra da Luz"

# Para cada plataforma: arquivo de opções de compilação e onde ligar a marca
# (arquivo, linha depois da qual inserir, linha a inserir).
PLATAFORMAS = {
    "windows": {
        "flags": "flags.windows.gn",
        "ganchos": [(
            "build.py",
            "        # Substitute domains",
            "        {m}: nome e ícones do Terra da Luz sobre o código-fonte\n"
            "        subprocess.run([sys.executable, str(_ROOT_DIR / 'terra-marca' / 'aplicar_overlay.py'), str(source_tree)], check=True)\n\n",
            "antes",
        )],
    },
    "linux": {
        "flags": "flags.linux.gn",
        "ganchos": [(
            "scripts/shared.sh",
            '        "${_main_repo}/utils/patches.py" apply "${_src_dir}" "${_main_repo}/patches" "${_root}/patches"\n',
            '        python3 "${_root}/terra-marca/aplicar_overlay.py" "${_src_dir}"  {m}\n',
            "depois",
        )],
    },
    "macos": {
        "flags": "flags.macos.gn",
        "ganchos": [
            (
                ".github/scripts/github_fetch_resources.sh",
                'python3 "$_main_repo/utils/patches.py" apply "$_src_dir" "$_main_repo/patches" "$_root_dir/patches"\n',
                'python3 "$_root_dir/terra-marca/aplicar_overlay.py" "$_src_dir"  {m}\n',
                "depois",
            ),
            (
                "build.sh",
                'python3 "$_main_repo/utils/patches.py" apply "$_src_dir" "$_main_repo/patches" "$_root_dir/patches"\n',
                'python3 "$_root_dir/terra-marca/aplicar_overlay.py" "$_src_dir"  {m}\n',
                "depois",
            ),
        ],
    },
}


def carregar_config():
    sys.path.insert(0, str(RAIZ / "ferramentas"))
    import terra_config
    return terra_config.carregar()


def copiar_patches(destino_repo: Path, cfg: dict):
    destino = destino_repo / "patches" / "terra"
    if destino.exists():
        shutil.rmtree(destino)
    destino.mkdir(parents=True)
    nomes = []
    for p in sorted((AQUI / "patches" / "terra").glob("*.patch")):
        texto = p.read_text(encoding="utf-8").replace("@TERRA_URL_ATUALIZACOES@", cfg["urlPublica"])
        (destino / p.name).write_text(texto, encoding="utf-8", newline="\n")
        nomes.append(f"terra/{p.name}")
    series = destino_repo / "patches" / "series"
    linhas = [l for l in series.read_text(encoding="utf-8").splitlines() if not l.startswith("terra/")]
    series.write_text("\n".join(linhas + nomes) + "\n", encoding="utf-8", newline="\n")
    print(f"  {len(nomes)} patches do Terra da Luz adicionados")


def acrescentar_flags(destino_repo: Path, nome: str):
    flags = destino_repo / nome
    texto = flags.read_text(encoding="utf-8")
    if MARCADOR in texto:
        texto = texto[: texto.index(MARCADOR)].rstrip() + "\n"
    extra = (AQUI / "flags.terra.gn").read_text(encoding="utf-8")
    flags.write_text(texto.rstrip("\n") + f"\n{MARCADOR}\n" + extra, encoding="utf-8", newline="\n")
    print(f"  opções de compilação adicionadas a {nome}")


def ligar_overlay(destino_repo: Path, ganchos):
    destino = destino_repo / "terra-marca"
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(AQUI / "overlay", destino / "overlay")
    shutil.copy2(AQUI / "aplicar_overlay.py", destino / "aplicar_overlay.py")

    for arquivo, ancora, linha, posicao in ganchos:
        alvo = destino_repo / arquivo
        texto = alvo.read_text(encoding="utf-8")
        if MARCADOR in texto:
            continue
        if ancora not in texto:
            sys.exit(f"Não encontrei o ponto de inserção em {arquivo}; a versão do ungoogled-chromium mudou.")
        nova = linha.replace("{m}", MARCADOR)
        texto = texto.replace(ancora, nova + ancora if posicao == "antes" else ancora + nova, 1)
        if arquivo == "build.py" and "import subprocess" not in texto:
            texto = texto.replace("import argparse", "import argparse\nimport subprocess", 1)
        alvo.write_text(texto, encoding="utf-8", newline="\n")
        print(f"  marca visual ligada a {arquivo}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pasta", type=Path, help="pasta do ungoogled-chromium da plataforma")
    ap.add_argument("--plataforma", choices=sorted(PLATAFORMAS), default="windows")
    args = ap.parse_args()
    plat = PLATAFORMAS[args.plataforma]
    if not (args.pasta / "patches" / "series").exists() or not (args.pasta / plat["flags"]).exists():
        sys.exit(f"{args.pasta} não parece ser o ungoogled-chromium para {args.plataforma}")
    cfg = carregar_config()
    print(f"Integrando o Terra da Luz ({args.plataforma}) em", args.pasta)
    copiar_patches(args.pasta, cfg)
    acrescentar_flags(args.pasta, plat["flags"])
    ligar_overlay(args.pasta, plat["ganchos"])
    print("Pronto.")


if __name__ == "__main__":
    main()

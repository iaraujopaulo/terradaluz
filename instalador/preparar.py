#!/usr/bin/env python3
"""Gera os arquivos de configuração dos instaladores a partir de:
  - terra.config.json       (endereço público do projeto)
  - politicas/chaves-publicas.json (IDs das extensões e chave pública de atualização)
  - politicas/*.json

Uso:
  python instalador/preparar.py --plataforma windows --versao 156.0.8078.73-1.1-t1.5
  python instalador/preparar.py --plataforma linux   --versao ...
  python instalador/preparar.py --plataforma macos   --versao ...

Saída em instalador/gerado/<plataforma>/
"""
import argparse
import json
import plistlib
import shutil
import uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CHAVE_POLITICAS_WIN = r"SOFTWARE\Policies\Chromium"
ID_APP = "br.terradaluz.TerraDaLuz"
HOST = "br.terradaluz.ajudante"

# nome da plataforma no manifesto de atualização
CHAVE_PLATAFORMA = {"windows": "windows-x64", "linux": "linux-x64", "macos": "macos-universal"}


def substituir(obj, trocas):
    if isinstance(obj, str):
        for k, v in trocas.items():
            obj = obj.replace(k, v)
        return obj
    if isinstance(obj, list):
        return [substituir(x, trocas) for x in obj]
    if isinstance(obj, dict):
        return {substituir(k, trocas): substituir(v, trocas) for k, v in obj.items()}
    return obj


# ---------------- Windows: registro para o Inno Setup ----------------

def iss_escapar(s: str) -> str:
    return s.replace('"', '""').replace("{", "{{")


def registro_inno(politicas: dict) -> str:
    linhas = ["; Gerado por instalador/preparar.py — não edite à mão", "[Registry]"]
    base = f'Root: HKLM64; Subkey: "{CHAVE_POLITICAS_WIN}"'
    linhas.append(f'{base}; Flags: uninsdeletekeyifempty')
    for nome, valor in politicas.items():
        if isinstance(valor, bool):
            linhas.append(f'{base}; ValueType: dword; ValueName: "{nome}"; ValueData: {int(valor)}; Flags: uninsdeletevalue')
        elif isinstance(valor, int):
            linhas.append(f'{base}; ValueType: dword; ValueName: "{nome}"; ValueData: {valor}; Flags: uninsdeletevalue')
        elif isinstance(valor, str):
            linhas.append(f'{base}; ValueType: string; ValueName: "{nome}"; ValueData: "{iss_escapar(valor)}"; Flags: uninsdeletevalue')
        elif isinstance(valor, list):
            sub = f'Root: HKLM64; Subkey: "{CHAVE_POLITICAS_WIN}\\{nome}"'
            linhas.append(f'{sub}; Flags: uninsdeletekey deletekey')
            for i, item in enumerate(valor, 1):
                linhas.append(f'{sub}; ValueType: string; ValueName: "{i}"; ValueData: "{iss_escapar(str(item))}"')
        elif isinstance(valor, dict):
            texto = json.dumps(valor, ensure_ascii=False, separators=(",", ":"))
            linhas.append(f'{base}; ValueType: string; ValueName: "{nome}"; ValueData: "{iss_escapar(texto)}"; Flags: uninsdeletevalue')
    return "\n".join(linhas) + "\n"


# ---------------- macOS: perfil de configuração (.mobileconfig) ----------------

def perfil_macos(politicas: dict) -> bytes:
    conteudo = dict(politicas)
    conteudo.update({
        "PayloadType": ID_APP,
        "PayloadIdentifier": f"{ID_APP}.politicas.conteudo",
        "PayloadUUID": str(uuid.uuid5(uuid.NAMESPACE_DNS, "politicas.conteudo.terradaluz.br")).upper(),
        "PayloadVersion": 1,
        "PayloadEnabled": True,
        "PayloadDisplayName": "Terra da Luz",
    })
    perfil = {
        "PayloadContent": [conteudo],
        "PayloadDisplayName": "Terra da Luz — privacidade e extensões embutidas",
        "PayloadDescription": "Desliga a telemetria, bloqueia cookies de terceiros, ativa o DNS seguro e instala as extensões embutidas do Terra da Luz (Núcleo, uBlock Origin e tema).",
        "PayloadOrganization": "Projeto Terra da Luz",
        "PayloadIdentifier": f"{ID_APP}.politicas",
        "PayloadType": "Configuration",
        "PayloadUUID": str(uuid.uuid5(uuid.NAMESPACE_DNS, "politicas.terradaluz.br")).upper(),
        "PayloadVersion": 1,
        "PayloadScope": "System",
        "PayloadRemovalDisallowed": False,
    }
    return plistlib.dumps(perfil, fmt=plistlib.FMT_XML)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plataforma", choices=sorted(CHAVE_PLATAFORMA), required=True)
    ap.add_argument("--versao", required=True)
    ap.add_argument("--publico", type=Path, default=RAIZ / "politicas" / "chaves-publicas.json")
    args = ap.parse_args()

    import sys
    sys.path.insert(0, str(RAIZ / "ferramentas"))
    import terra_config
    cfg = terra_config.carregar()
    pub = json.loads(args.publico.read_text(encoding="utf-8"))
    url = cfg["urlPublica"].rstrip("/") + "/"
    ids = pub["ids"]
    trocas = {"@URL_PUBLICA@": url, "@ID_NUCLEO@": ids["nucleo"], "@ID_UBLOCK@": ids["ublock"], "@ID_TEMA@": ids["tema"]}
    plat = CHAVE_PLATAFORMA[args.plataforma]

    saida = RAIZ / "instalador" / "gerado" / args.plataforma
    if saida.exists():
        shutil.rmtree(saida)
    saida.mkdir(parents=True)

    politicas = substituir(json.loads((RAIZ / "politicas" / "politicas.json").read_text(encoding="utf-8")), trocas)
    politicas = {k: v for k, v in politicas.items() if not k.startswith("_")}
    shutil.copy2(RAIZ / "politicas" / "initial_preferences", saida / "initial_preferences")
    (saida / "versao.txt").write_text(args.versao + "\n", encoding="utf-8")

    ajudante = {
        "manifestoAtualizacao": f"{url}atualizacoes/{cfg.get('canal', 'estavel')}-{plat}.json",
        "chavePublicaAtualizacao": pub["chavePublicaAtualizacao"],
        "idsPermitidos": [ids["nucleo"]],
        "plataforma": plat,
    }
    host = {
        "name": HOST,
        "description": "Ajudante do navegador Terra da Luz",
        "path": "terra-ajudante.exe",
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{ids['nucleo']}/"],
    }

    if args.plataforma == "windows":
        (saida / "politicas.iss").write_text(registro_inno(politicas), encoding="utf-8-sig")
        (saida / "versao.iss").write_text(f'#define VersaoTerra "{args.versao}"\n#define IdNucleo "{ids["nucleo"]}"\n', encoding="utf-8-sig")

    elif args.plataforma == "linux":
        ajudante["navegador"] = "/app/bin/terra-da-luz"
        (saida / "politicas.json").write_text(json.dumps(politicas, indent=2, ensure_ascii=False), encoding="utf-8")
        modelo = (RAIZ / "instalador" / "linux" / "terra-da-luz.sh").read_text(encoding="utf-8")
        (saida / "terra-da-luz.sh").write_text(modelo.replace("@ID_NUCLEO@", ids["nucleo"]), encoding="utf-8")
        host = None  # registrado a cada abertura pelo terra-da-luz.sh

    elif args.plataforma == "macos":
        ajudante["navegador"] = "/Applications/Terra da Luz.app/Contents/MacOS/Terra da Luz"
        (saida / "TerraDaLuz-Politicas.mobileconfig").write_bytes(perfil_macos(politicas))
        host["path"] = "/Library/Application Support/TerraDaLuz/terra-ajudante"

    (saida / "terra-ajudante.json").write_text(json.dumps(ajudante, indent=2), encoding="utf-8")
    if host:
        (saida / f"{HOST}.json").write_text(json.dumps(host, indent=2), encoding="utf-8")
    print(f"arquivos do instalador ({args.plataforma}) gerados em", saida)


if __name__ == "__main__":
    main()

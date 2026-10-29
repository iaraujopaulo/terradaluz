#!/bin/bash
# Monta o instalador .pkg do macOS (roda num Mac, no GitHub Actions).
# Uso: construir-pkg.sh <app-arm64> <app-x64> <ajudante-universal> <versao> <saida.pkg>
set -euo pipefail
APP_ARM="$1"; APP_X64="$2"; AJUDANTE="$3"; VERSAO="$4"; SAIDA="$5"
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
GERADO="$RAIZ/instalador/gerado/macos"
T="$(mktemp -d)"
VERSAO_PKG=$(echo "$VERSAO" | tr -c '0-9.\n' '.' | sed 's/\.\.*/./g; s/\.$//')

# pacote do aplicativo, um para cada tipo de processador
for arq in arm64 x64; do
  APP=$([ "$arq" = arm64 ] && echo "$APP_ARM" || echo "$APP_X64")
  mkdir -p "$T/raiz-$arq/Applications"
  ditto "$APP" "$T/raiz-$arq/Applications/Terra da Luz.app"
  pkgbuild --root "$T/raiz-$arq" --install-location / \
    --identifier "br.terradaluz.TerraDaLuz.app-$arq" --version "$VERSAO_PKG" \
    "$T/app-$arq.pkg"
done

# pacote comum: ajudante, políticas, preferências iniciais e atualização automática
S="$T/raiz-comum/Library/Application Support/TerraDaLuz"
mkdir -p "$S" "$T/raiz-comum/Library/LaunchDaemons"
install -m 755 "$AJUDANTE" "$S/terra-ajudante"
cp "$GERADO/terra-ajudante.json" "$GERADO/versao.txt" "$GERADO/initial_preferences" \
   "$GERADO/br.terradaluz.ajudante.json" "$GERADO/TerraDaLuz-Politicas.mobileconfig" "$S/"
cp "$AQUI/br.terradaluz.atualizacao.plist" "$T/raiz-comum/Library/LaunchDaemons/"
pkgbuild --root "$T/raiz-comum" --install-location / --scripts "$AQUI/scripts" \
  --identifier br.terradaluz.TerraDaLuz.comum --version "$VERSAO_PKG" "$T/comum.pkg"

productbuild --distribution "$AQUI/distribution.xml" --resources "$AQUI/recursos" \
  --package-path "$T" --version "$VERSAO_PKG" "$SAIDA"
rm -rf "$T"
echo "instalador criado: $SAIDA"

#!/usr/bin/env bash
# Coloca as chaves privadas do projeto na pasta ./chaves (só durante a execução
# no GitHub Actions; a pasta é apagada no fim de cada passo que a usa).
#
# Fonte principal: o segredo CHAVES_TERRA, que é o arquivo
# SEGREDO-CHAVES_TERRA.txt do pacote chaves-PRIVADAS-terra-da-luz.zip
# (todas as chaves de uma vez). Segredos separados (CHAVE_NUCLEO, CHAVE_TEMA,
# CHAVE_UBLOCK, CHAVE_ATUALIZACAO, CHAVE_GPG_FLATPAK) também funcionam.
#
# Uso: ferramentas/carregar-chaves.sh nucleo.pem tema.pem ...   (as que o passo precisa)
set -euo pipefail
umask 077
mkdir -p chaves

if [ -n "${CHAVES_TERRA:-}" ]; then
  TMP="$(mktemp)"
  if ! printf '%s' "$CHAVES_TERRA" | tr -d ' \r\n\t' | base64 -d > "$TMP" 2>/dev/null; then
    echo "O segredo CHAVES_TERRA não está no formato certo. Copie TODO o conteúdo de SEGREDO-CHAVES_TERRA.txt." >&2
    exit 1
  fi
  unzip -o -q "$TMP" -d chaves
  rm -f "$TMP"
fi

escrever() { [ -n "${2:-}" ] && printf '%s\n' "$2" > "chaves/$1" || true; }
escrever nucleo.pem          "${CHAVE_NUCLEO:-}"
escrever tema.pem            "${CHAVE_TEMA:-}"
escrever ublock.pem          "${CHAVE_UBLOCK:-}"
escrever atualizacao.key     "${CHAVE_ATUALIZACAO:-}"
escrever flatpak-privada.asc "${CHAVE_GPG_FLATPAK:-}"

falta=0
for arquivo in "$@"; do
  if [ ! -s "chaves/$arquivo" ]; then
    echo "Falta a chave $arquivo. Cadastre o segredo CHAVES_TERRA (veja o LEIAME, seção 2)." >&2
    falta=1
  fi
done
exit $falta

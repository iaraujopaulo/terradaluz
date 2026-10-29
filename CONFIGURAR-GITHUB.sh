#!/usr/bin/env bash
# Terra da Luz — configuração automática no GitHub (Linux e macOS)
#
# Faz tudo sozinho: entra no GitHub, cria o repositório, envia o projeto,
# cadastra as chaves (segredo CHAVES_TERRA), ativa o site de atualizações e
# inicia a compilação dos 3 instaladores (Windows, Linux e macOS).
#
# Precisa do git, do unzip e do GitHub CLI (gh):
#   Ubuntu/Debian: sudo apt install git unzip gh
#   Fedora:        sudo dnf install git unzip gh
#   macOS:         brew install git gh
# Uso:  bash CONFIGURAR-GITHUB.sh [caminho/do/chaves-PRIVADAS-terra-da-luz.zip]
set -euo pipefail
cd "$(dirname "$0")"
RAIZ="$PWD"
passo() { printf '\n\033[36m[%s/6] %s\033[0m\n' "$1" "$2"; }
falhar() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

passo 1 "Conferindo ferramentas..."
for c in git gh unzip; do command -v "$c" >/dev/null || falhar "Falta o programa '$c'. Veja as instruções no começo deste arquivo."; done
echo "  ok"

passo 2 "Lendo as chaves do projeto..."
ZIP="${1:-}"
PASTAS=("$RAIZ" "$RAIZ/.." "$HOME/Downloads" "$HOME/Transferências" "$HOME/Desktop")
if [ -z "$ZIP" ]; then
  ACHADOS=()
  for d in "${PASTAS[@]}"; do
    for f in "$d"/*CHAVES_TERRA*.txt "$d"/chaves-PRIVADAS-terra-da-luz*.zip; do [ -f "$f" ] && ACHADOS+=("$f"); done
  done
  if [ ${#ACHADOS[@]} -gt 0 ]; then ZIP="$(ls -t "${ACHADOS[@]}" | head -1)"; fi
fi
[ -n "$ZIP" ] && [ -f "$ZIP" ] || falhar "Não achei as chaves. Rode: bash CONFIGURAR-GITHUB.sh /caminho/do/chaves-PRIVADAS-terra-da-luz-v2.zip"
case "$ZIP" in
  *.txt) SEGREDO="$(tr -d ' \r\n' < "$ZIP")" ;;
  *)     SEGREDO="$(unzip -p "$ZIP" 'CHAVES_TERRA.txt' 2>/dev/null || unzip -p "$ZIP" 'SEGREDO-CHAVES_TERRA.txt' 2>/dev/null || true)"
         SEGREDO="$(printf '%s' "$SEGREDO" | tr -d ' \r\n')" ;;
esac
[ -n "$SEGREDO" ] || falhar "Esse arquivo não tem o CHAVES_TERRA.txt. Use o pacote de chaves mais novo (v2)."
echo "  chaves lidas de $ZIP"

passo 3 "Entrando no GitHub (o navegador vai abrir)..."
if ! gh auth status >/dev/null 2>&1; then
  gh auth login --hostname github.com --git-protocol https --web --scopes workflow
else
  gh auth refresh --hostname github.com --scopes workflow >/dev/null 2>&1 || true
fi
gh auth setup-git
USUARIO="$(gh api user --jq .login)"
echo "  conectado como $USUARIO"

passo 4 "Criando o repositório e enviando o projeto..."
read -r -p "  Nome do repositório (Enter = terra-da-luz): " NOME
NOME="${NOME:-terra-da-luz}"
REPO="$USUARIO/$NOME"
[ -d .git ] || git init -q -b main
git config user.name  >/dev/null || git config user.name "$USUARIO"
git config user.email >/dev/null || git config user.email "$USUARIO@users.noreply.github.com"
git add -A
git commit -q -m "Terra da Luz" >/dev/null 2>&1 || true
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "  o repositório $REPO já existe; vou enviar as mudanças"
else
  gh repo create "$REPO" --public --description "Navegador Terra da Luz: ungoogled-chromium com privacidade" >/dev/null
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"

passo 5 "Cadastrando as chaves e ativando o site de atualizações..."
# as chaves entram antes do envio, para a primeira execução já encontrá-las
gh secret set CHAVES_TERRA --repo "$REPO" --body "$SEGREDO"
gh api -X PUT "repos/$REPO/actions/permissions/workflow" -f default_workflow_permissions=write -F can_approve_pull_request_reviews=false >/dev/null
git push -u origin main
if ! git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  SITE="$(mktemp -d)"
  (
    cd "$SITE"
    git init -q -b gh-pages
    git config user.name "$USUARIO"; git config user.email "$USUARIO@users.noreply.github.com"
    touch .nojekyll
    echo '<!doctype html><meta charset="utf-8"><title>Terra da Luz</title><p>Em construção: a primeira versão está sendo compilada.</p>' > index.html
    git add -A && git commit -q -m "Site do Terra da Luz"
    git push -q "https://github.com/$REPO.git" gh-pages
  )
  rm -rf "$SITE"
fi
gh api "repos/$REPO/pages" >/dev/null 2>&1 || \
  gh api -X POST "repos/$REPO/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' >/dev/null
DONO_MIN="$(echo "$USUARIO" | tr '[:upper:]' '[:lower:]')"
echo "  site: https://$DONO_MIN.github.io/$NOME/"

passo 6 "Publicando as extensões e iniciando a compilação dos 3 instaladores..."
sleep 8
gh workflow run lancar.yml --repo "$REPO" || { sleep 15; gh workflow run lancar.yml --repo "$REPO"; } || \
  echo "  Não consegui iniciar sozinho. Abra https://github.com/$REPO/actions e rode 'Lançar nova versão'."

printf '\n\033[32mPronto! Tudo configurado.\033[0m\n'
echo "  - Acompanhe a compilação: https://github.com/$REPO/actions (leva de 10 a 20 horas)"
echo "  - Os instaladores aparecem em: https://github.com/$REPO/releases"
echo "  - Site com os botões de download: https://$DONO_MIN.github.io/$NOME/"
echo "Para lançar uma versão nova no futuro, rode este arquivo de novo."

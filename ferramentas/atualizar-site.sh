#!/usr/bin/env bash
# Publica arquivos no ramo gh-pages (servido pelo GitHub Pages).
# Uso: ferramentas/atualizar-site.sh <pasta-com-arquivos> <mensagem-do-commit>
#
# Os arquivos da pasta são copiados por cima do site, mantendo o resto. O ramo
# gh-pages fica sempre com um único commit (enviado com --force), para o
# repositório não crescer a cada versão do navegador.
set -euo pipefail
ORIGEM="$(cd "$1" && pwd)"
MENSAGEM="$2"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${GITHUB_REPOSITORY:-SEU-USUARIO/terra-da-luz}"

git config user.name  "terra-da-luz-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

SITE="$(mktemp -d)"
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch --depth 1 origin gh-pages
  git archive FETCH_HEAD | tar -x -C "$SITE"
fi

# pasta do Flatpak: a versão nova substitui a antiga inteira
if [ -d "$ORIGEM/flatpak/repo" ]; then rm -rf "$SITE/flatpak/repo"; fi
cp -r "$ORIGEM"/. "$SITE"/
touch "$SITE/.nojekyll"
sed "s|@REPOSITORIO@|$REPO|g" "$RAIZ/site-modelo/index.html" > "$SITE/index.html"
cp "$RAIZ/marca/png/terra-da-luz-256.png" "$SITE/simbolo.png"

cd "$SITE"
git init -q -b gh-pages
git config user.name  "terra-da-luz-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "$MENSAGEM"
URL_REMOTO=$(git -C "$RAIZ" remote get-url origin)
EXTRA=$(git -C "$RAIZ" config --get-regexp '^http\..*\.extraheader$' | head -1 | cut -d' ' -f2- || true)
for tentativa in 1 2 3; do
  if [ -n "$EXTRA" ]; then
    git -c http.extraheader="$EXTRA" push -q --force "$URL_REMOTO" gh-pages && exit 0
  else
    git push -q --force "$URL_REMOTO" gh-pages && exit 0
  fi
  sleep $((tentativa * 10))
done
echo "não foi possível publicar no gh-pages" >&2
exit 1

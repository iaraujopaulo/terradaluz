#!/bin/sh
# Inicia o Terra da Luz dentro do Flatpak.
# O zypak permite que o isolamento de processos (sandbox) do Chromium funcione
# dentro da sandbox do Flatpak.
export CHROME_DESKTOP=br.terradaluz.TerraDaLuz.desktop
export CHROME_WRAPPER=/app/bin/terra-da-luz
export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"

# registra o ajudante (modo contêineres e verificação de versões) para o Núcleo
/app/bin/terra-ajudante registrar-host "@ID_NUCLEO@" >/dev/null 2>&1 || true

exec zypak-wrapper /app/terra-da-luz/chrome "$@"

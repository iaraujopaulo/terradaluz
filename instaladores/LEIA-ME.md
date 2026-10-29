# Instaladores do Terra da Luz

Os três instaladores são gerados pelo GitHub Actions a partir das receitas desta pasta do projeto:

| Sistema | Receita | Arquivo gerado |
|---|---|---|
| Windows 10/11 | `instalador/windows/terra-da-luz.iss` (Inno Setup) | `TerraDaLuz-Setup-<versão>-x64.exe` |
| Linux (qualquer distribuição) | `instalador/linux/br.terradaluz.TerraDaLuz.yml` (Flatpak) | `TerraDaLuz-<versão>-x86_64.flatpak` |
| macOS 12+ (Apple Silicon e Intel) | `instalador/macos/construir-pkg.sh` | `TerraDaLuz-<versão>-macOS.pkg` |

Eles precisam do navegador compilado (o Chromium), por isso só existem depois da
primeira compilação. Veja o passo a passo no `LEIAME.md` (seção 2): ao criar a
tag `v1`, os três são compilados e publicados juntos em *Releases* e no site
do projeto.

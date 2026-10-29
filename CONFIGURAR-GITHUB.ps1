# Terra da Luz — configuração automática no GitHub (Windows)
#
# Faz tudo sozinho:
#   1. instala o Git e o GitHub CLI (se faltarem)
#   2. entra na sua conta do GitHub (abre o navegador para você autorizar)
#   3. cria o repositório público e envia o projeto
#   4. cadastra as chaves (segredo CHAVES_TERRA) a partir do chaves-PRIVADAS-terra-da-luz.zip
#   5. libera o GitHub Actions para publicar e ativa o site de atualizações (GitHub Pages)
#   6. publica as extensões e inicia a compilação dos 3 instaladores (Windows, Linux e macOS)
#
# Como usar: clique com o botão direito neste arquivo > "Executar com o PowerShell".
# Deixe o chaves-PRIVADAS-terra-da-luz.zip na pasta Downloads ou ao lado da pasta do projeto.

$ErrorActionPreference = 'Continue'  # erros dos programas são conferidos por $LASTEXITCODE
$raiz = $PSScriptRoot
Set-Location $raiz

function Passo($n, $texto) { Write-Host ""; Write-Host "[$n/6] $texto" -ForegroundColor Cyan }
function Tem($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function AtualizarPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Falhar($texto) {
  Write-Host ""; Write-Host $texto -ForegroundColor Red
  Read-Host 'Pressione Enter para fechar'; exit 1
}

# ---------------------------------------------------------------- 1
Passo 1 'Conferindo o Git e o GitHub CLI...'
foreach ($p in @(@{cmd = 'git'; id = 'Git.Git'}, @{cmd = 'gh'; id = 'GitHub.cli'})) {
  if (-not (Tem $p.cmd)) {
    if (-not (Tem 'winget')) { Falhar "Instale o $($p.id) manualmente e rode de novo (winget não encontrado)." }
    Write-Host "  instalando $($p.id)..."
    winget install --id $p.id -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
    AtualizarPath
    if (-not (Tem $p.cmd)) { Falhar "Não consegui instalar o $($p.id). Feche esta janela, abra de novo e tente outra vez." }
  }
}
Write-Host '  ok'

# ---------------------------------------------------------------- 2
Passo 2 'Lendo as chaves do projeto...'
$pastas = @($raiz, (Split-Path -Parent $raiz), (Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Desktop'))
$segredo = $null
# 1) arquivo solto CHAVES_TERRA.txt (ou SEGREDO-CHAVES_TERRA.txt)
$solto = $pastas | ForEach-Object { Get-ChildItem -Path $_ -Filter '*CHAVES_TERRA*.txt' -ErrorAction SilentlyContinue } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($solto) { $segredo = (Get-Content $solto.FullName -Raw).Trim(); $zip = $solto.FullName }
# 2) dentro do zip de chaves (qualquer nome que comece com chaves-PRIVADAS-terra-da-luz)
if (-not $segredo) {
  $zips = $pastas | ForEach-Object { Get-ChildItem -Path $_ -Filter 'chaves-PRIVADAS-terra-da-luz*.zip' -ErrorAction SilentlyContinue } |
    Sort-Object LastWriteTime -Descending
  if (-not $zips) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = 'Escolha o arquivo chaves-PRIVADAS-terra-da-luz (.zip) ou o CHAVES_TERRA.txt'
    $dlg.Filter = 'Chaves do Terra da Luz (*.zip;*.txt)|*.zip;*.txt'
    if ($dlg.ShowDialog() -ne 'OK') { Falhar 'Sem as chaves não dá para publicar atualizações.' }
    $zips = @(Get-Item $dlg.FileName)
  }
  foreach ($z in $zips) {
    if ($z.Extension -eq '.txt') { $segredo = (Get-Content $z.FullName -Raw).Trim(); $zip = $z.FullName; break }
    $tmp = Join-Path $env:TEMP ("terra-chaves-" + [guid]::NewGuid())
    Expand-Archive -Path $z.FullName -DestinationPath $tmp -Force -ErrorAction SilentlyContinue
    $txt = Get-ChildItem -Path $tmp -Recurse -Filter '*CHAVES_TERRA*.txt' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($txt) { $segredo = (Get-Content $txt.FullName -Raw).Trim(); $zip = $z.FullName }
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    if ($segredo) { break }
  }
}
if (-not $segredo) { Falhar 'Não achei o CHAVES_TERRA.txt. Baixe o pacote de chaves mais novo (chaves-PRIVADAS-terra-da-luz-v2.zip).' }
Write-Host "  chaves lidas de $zip"

# ---------------------------------------------------------------- 3
Passo 3 'Entrando no GitHub (o navegador vai abrir: copie o código mostrado aqui)...'
$null = & gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  gh auth login --hostname github.com --git-protocol https --web --scopes 'workflow'
  if ($LASTEXITCODE -ne 0) { Falhar 'Não foi possível entrar no GitHub.' }
} else {
  # garante a permissão de enviar os arquivos de .github/workflows
  gh auth refresh --hostname github.com --scopes 'workflow' 2>$null | Out-Null
}
gh auth setup-git | Out-Null
$usuario = (gh api user --jq .login).Trim()
Write-Host "  conectado como $usuario"

# ---------------------------------------------------------------- 4
Passo 4 'Criando o repositório e enviando o projeto...'
$nome = Read-Host '  Nome do repositório (Enter = terra-da-luz)'
if ([string]::IsNullOrWhiteSpace($nome)) { $nome = 'terra-da-luz' }
$repo = "$usuario/$nome"

if (-not (Test-Path (Join-Path $raiz '.git'))) {
  git init -q -b main
}
if (-not (git config user.name)) { git config user.name $usuario }
if (-not (git config user.email)) { git config user.email "$usuario@users.noreply.github.com" }
git add -A
git commit -q -m 'Terra da Luz' 2>$null | Out-Null

$null = & gh repo view $repo 2>&1
if ($LASTEXITCODE -ne 0) {
  gh repo create $repo --public --description 'Navegador Terra da Luz: ungoogled-chromium com privacidade' | Out-Null
  if ($LASTEXITCODE -ne 0) { Falhar 'Não consegui criar o repositório.' }
} else {
  Write-Host "  o repositório $repo já existe; vou enviar as mudanças"
}
if (-not (git remote 2>$null | Select-String -Quiet '^origin$')) { git remote add origin "https://github.com/$repo.git" }

# ---------------------------------------------------------------- 5
Passo 5 'Cadastrando as chaves e ativando o site de atualizações...'
# as chaves entram antes do envio, para a primeira execução já encontrá-las
gh secret set CHAVES_TERRA --repo $repo --body $segredo
if ($LASTEXITCODE -ne 0) { Falhar 'Não consegui cadastrar o segredo CHAVES_TERRA.' }
gh api -X PUT "repos/$repo/actions/permissions/workflow" -f default_workflow_permissions=write -F can_approve_pull_request_reviews=false | Out-Null
git push -u origin main
if ($LASTEXITCODE -ne 0) { Falhar 'Não consegui enviar o projeto.' }

# ramo gh-pages inicial e GitHub Pages
$null = & git ls-remote --exit-code --heads origin gh-pages 2>&1
if ($LASTEXITCODE -ne 0) {
  $site = Join-Path $env:TEMP ("terra-site-" + [guid]::NewGuid())
  New-Item -ItemType Directory $site | Out-Null
  Push-Location $site
  git init -q -b gh-pages
  git config user.name $usuario; git config user.email "$usuario@users.noreply.github.com"
  New-Item .nojekyll -ItemType File | Out-Null
  Set-Content index.html '<!doctype html><meta charset="utf-8"><title>Terra da Luz</title><p>Em construção: a primeira versão está sendo compilada.</p>'
  git add -A; git commit -q -m 'Site do Terra da Luz'
  git push -q "https://github.com/$repo.git" gh-pages
  Pop-Location
  Remove-Item -Recurse -Force $site
}
$null = & gh api "repos/$repo/pages" 2>&1
if ($LASTEXITCODE -ne 0) {
  gh api -X POST "repos/$repo/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' | Out-Null
}
Write-Host "  site: https://$($usuario.ToLower()).github.io/$nome/"

# ---------------------------------------------------------------- 6
Passo 6 'Publicando as extensões e iniciando a compilação dos 3 instaladores...'
Start-Sleep -Seconds 8
gh workflow run lancar.yml --repo $repo
if ($LASTEXITCODE -ne 0) {
  Start-Sleep -Seconds 15
  gh workflow run lancar.yml --repo $repo
  if ($LASTEXITCODE -ne 0) { Write-Host "  Não consegui iniciar sozinho. Abra https://github.com/$repo/actions e rode 'Lançar nova versão'." -ForegroundColor Yellow }
}

Write-Host ''
Write-Host 'Pronto! Tudo configurado.' -ForegroundColor Green
Write-Host "  - Acompanhe a compilação: https://github.com/$repo/actions"
Write-Host '    (leva de 10 a 20 horas; pode desligar este computador)'
Write-Host "  - Os instaladores aparecem em: https://github.com/$repo/releases"
Write-Host "  - Site com os botões de download: https://$($usuario.ToLower()).github.io/$nome/"
Write-Host ''
Write-Host 'Para lançar uma versão nova no futuro, rode este arquivo de novo.'
Start-Process "https://github.com/$repo/actions"
Read-Host 'Pressione Enter para fechar'

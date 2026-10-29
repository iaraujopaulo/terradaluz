# Experimente o Terra da Luz HOJE, sem compilar o Chromium.
#
# Este script prepara o ajudante e o Modo Internet Explorer e os registra
# para o Google Chrome, o Microsoft Edge e o Chromium que você já tem. Depois
# basta carregar a pasta extensoes\nucleo como extensão (modo desenvolvedor).
#
# Como executar: clique com o botão direito neste arquivo > "Executar com o
# PowerShell". Não precisa ser administrador.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $env:LOCALAPPDATA 'TerraDaLuz\Experimentar'
New-Item -ItemType Directory -Force $destino | Out-Null

Write-Host '1/4  Copiando o ajudante...' -ForegroundColor Cyan
$ajudante = Join-Path $raiz 'pre-compilados\windows-x64\terra-ajudante.exe'
if (-not (Test-Path $ajudante)) { throw "Não encontrei $ajudante" }
Copy-Item $ajudante $destino -Force

Write-Host '2/4  Compilando a janela do Modo Internet Explorer (TerraIE.exe)...' -ForegroundColor Cyan
Copy-Item (Join-Path $raiz 'instalador\windows\terra-da-luz.ico') (Join-Path $raiz 'iehost\terra-da-luz.ico') -Force
& cmd /c "`"$raiz\iehost\compilar.cmd`""
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o TerraIE.exe' }
Copy-Item (Join-Path $raiz 'iehost\TerraIE.exe') $destino -Force

Write-Host '3/4  Configurando...' -ForegroundColor Cyan
$publico = Get-Content (Join-Path $raiz 'politicas\chaves-publicas.json') -Raw | ConvertFrom-Json
$id = $publico.ids.nucleo
$cfg = @{ idsPermitidos = @($id); chavePublicaAtualizacao = $publico.chavePublicaAtualizacao } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $destino 'terra-ajudante.json'), $cfg)  # UTF-8 sem BOM
$host_ = [ordered]@{
  name = 'br.terradaluz.ajudante'
  description = 'Ajudante do navegador Terra da Luz'
  path = 'terra-ajudante.exe'
  type = 'stdio'
  allowed_origins = @("chrome-extension://$id/")
} | ConvertTo-Json
$manifesto = Join-Path $destino 'br.terradaluz.ajudante.json'
[IO.File]::WriteAllText($manifesto, $host_)  # o navegador não aceita BOM

Write-Host '4/4  Registrando para Chrome, Edge e Chromium...' -ForegroundColor Cyan
foreach ($navegador in 'Google\Chrome', 'Microsoft\Edge', 'Chromium', 'TerraDaLuz') {
  $chave = "HKCU:\Software\$navegador\NativeMessagingHosts\br.terradaluz.ajudante"
  New-Item -Force $chave | Out-Null
  Set-ItemProperty $chave -Name '(default)' -Value $manifesto
}

Write-Host ''
Write-Host 'Pronto! Agora:' -ForegroundColor Green
Write-Host '  1. Abra chrome://extensions (ou edge://extensions)'
Write-Host '  2. Ligue o "Modo do desenvolvedor"'
Write-Host "  3. Clique em 'Carregar sem compactação' e escolha: $raiz\extensoes\nucleo"
Write-Host "  4. O ID deve ser $id"
Write-Host '  5. Abra uma nova aba e clique no ícone do Terra da Luz.'
Write-Host ''
Read-Host 'Pressione Enter para fechar'

# Preparar e abrir o Souz Pro Lyric Desktop v0.3 no Windows.
# Execute em PowerShell COMUM a partir da pasta raiz:
# powershell -ExecutionPolicy Bypass -File .\scripts\install-and-run.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
foreach($command in @('git','cmake','node','npm')) {
  if (!(Get-Command $command -ErrorAction SilentlyContinue)) { throw "Ferramenta ausente do PATH: $command" }
}
Write-Host '1/3 Compilando emissor Spout2 (SDK, C++ e DLL)' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'build-spout.ps1')
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Build Spout2 falhou' }
Write-Host '2/3 Instalando Electron' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install falhou' }
Write-Host '3/3 Verificando arquivos e abrindo aplicativo' -ForegroundColor Cyan
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Verificacao do projeto falhou' }
npm start

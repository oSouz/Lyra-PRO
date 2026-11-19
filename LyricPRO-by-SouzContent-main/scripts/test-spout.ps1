# Teste do Spout2 sem Electron: publica padrão de cores e transparência até Ctrl+C.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exe = Join-Path $root 'native\build\Release\souz-spout-sender.exe'
if (!(Test-Path $exe)) { throw 'Emissor nao compilado. Execute scripts\build-spout.ps1 primeiro.' }
$dll = Join-Path (Split-Path $exe) 'SpoutDX.dll'
if (!(Test-Path $dll)) { throw 'SpoutDX.dll nao encontrada ao lado do executavel. Recompile com build-spout.ps1.' }
Write-Host 'Teste Spout2 nativo: procure SOUZ_TESTE na aba Sources / Spout do Resolume.' -ForegroundColor Cyan
Write-Host 'Ctrl+C encerra. Nao abra a transmissao do aplicativo durante este teste.'
& $exe 1280 720 SOUZ_TESTE --test-pattern
Write-Host "Codigo de saida: $LASTEXITCODE"

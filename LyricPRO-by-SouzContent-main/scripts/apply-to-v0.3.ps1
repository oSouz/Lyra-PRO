param(
  [string]$Destino = ""
)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Destino)) {
  $downloads = Join-Path $env:USERPROFILE 'Downloads'
  $Destino = Join-Path $downloads 'souz-pro-lyric-desktop-v0.3\souz-pro-lyric-desktop'
}
if (!(Test-Path (Join-Path $Destino 'package.json'))) { throw "Pasta v0.3 não encontrada: $Destino" }
if (!(Test-Path (Join-Path $Destino 'node_modules\electron\dist\electron.exe'))) { throw 'Electron não foi encontrado na pasta de destino. Informe a pasta v0.3 que já funciona.' }
Get-Process electron -ErrorAction SilentlyContinue | Out-Null
Write-Host 'Feche o Souz Pro Lyric antes de prosseguir.' -ForegroundColor Yellow
$reply=Read-Host 'Já fechou o aplicativo? (S/N)'
if ($reply -notin @('S','s','sim','SIM')) { throw 'Atualização cancelada.' }
$backup = Join-Path $Destino ('backup-v0.3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path (Join-Path $backup 'app') | Out-Null
Copy-Item (Join-Path $Destino 'main.cjs') (Join-Path $backup 'main.cjs')
Copy-Item (Join-Path $Destino 'app\souz-pro-lyric.html') (Join-Path $backup 'app\souz-pro-lyric.html')
Copy-Item (Join-Path $source 'main.cjs') (Join-Path $Destino 'main.cjs') -Force
Copy-Item (Join-Path $source 'app\souz-pro-lyric.html') (Join-Path $Destino 'app\souz-pro-lyric.html') -Force
Write-Host "Atualização aplicada. Backup: $backup" -ForegroundColor Green
Write-Host "Inicie com: cd `"$Destino`" ; npm start"

param(
  [Parameter(Mandatory=$true)][string]$Destino
)
$ErrorActionPreference='Stop'
$origem=Split-Path -Parent $PSScriptRoot
$destFull=(Resolve-Path -LiteralPath $Destino).Path
if (-not (Test-Path -LiteralPath (Join-Path $destFull 'main.cjs'))) { throw 'Pasta de destino invalida: main.cjs ausente.' }
if (-not (Test-Path -LiteralPath (Join-Path $destFull 'app\souz-pro-lyric.html'))) { throw 'HTML nao encontrado no destino.' }
if ($origem -eq $destFull) { throw 'Nao aplique o patch sobre a propria pasta de origem.' }
$backup=Join-Path $destFull ('backup-pre-v0.6.1-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
$arquivos=@('main.cjs','app\souz-pro-lyric.html','native\souz-spout-sender.cpp','package.json')
foreach($item in $arquivos) {
  $from=Join-Path $origem $item
  $to=Join-Path $destFull $item
  if(-not (Test-Path -LiteralPath $from)) { throw "Arquivo de origem ausente: $from" }
  $toDir=Split-Path -Parent $to
  if(-not (Test-Path $toDir)){New-Item -ItemType Directory -Force $toDir | Out-Null}
  if(Test-Path -LiteralPath $to) {
    $save=Join-Path $backup $item
    New-Item -ItemType Directory -Force (Split-Path -Parent $save) | Out-Null
    Copy-Item -LiteralPath $to -Destination $save -Force
  }
}
foreach($item in $arquivos) {
  Copy-Item -LiteralPath (Join-Path $origem $item) -Destination (Join-Path $destFull $item) -Force
}
Copy-Item -LiteralPath (Join-Path $origem 'LEIA-ME-v0.6.1.md') -Destination (Join-Path $destFull 'LEIA-ME-v0.6.1.md') -Force
Write-Host "Atualizacao v0.6.1 aplicada em: $destFull"
Write-Host "Backup anterior: $backup"
Write-Host 'O executavel Spout2 existente foi preservado. Rode npm run check e npm start.'

param(
  [string]$OrigemSpout = ""
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$targetDir = Join-Path $root 'native\build\Release'
New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
if ($OrigemSpout) {
  if (!(Test-Path $OrigemSpout)) { throw "Pasta de origem nao existe: $OrigemSpout" }
  $origem = (Resolve-Path $OrigemSpout).Path
  if (Test-Path (Join-Path $origem 'native\build\Release\souz-spout-sender.exe')) {
    $origem = Join-Path $origem 'native\build\Release'
  }
  foreach ($file in @('souz-spout-sender.exe','SpoutDX.dll')) {
    $f = Join-Path $origem $file
    if (!(Test-Path $f)) {throw "Arquivo ausente na origem: $f"}
    Copy-Item $f (Join-Path $targetDir $file) -Force
  }
}
foreach ($file in @('souz-spout-sender.exe','SpoutDX.dll')) {
  $f = Join-Path $targetDir $file
  if (!(Test-Path $f)) {throw "Falta $file em $targetDir. Informe -OrigemSpout com a pasta que ja funciona no Resolume."}
}
Write-Host 'Verificando projeto...' -ForegroundColor Cyan
npm run check
if ($LASTEXITCODE -ne 0) {throw 'Falha na verificacao do projeto.'}
Write-Host 'Instalando dependencias do empacotador...' -ForegroundColor Cyan
npm install --no-audit --no-fund --foreground-scripts
if ($LASTEXITCODE -ne 0) {throw 'Falha no npm install.'}
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (!(Test-Path $electron)) {
  throw 'electron.exe nao encontrado. A instalacao do Electron falhou. Veja LEIA-ME-INSTALADOR.md: recuperacao manual da versao de Electron instalada.'
}
Write-Host 'Criando o instalador Windows...' -ForegroundColor Cyan
npm run dist:win
if ($LASTEXITCODE -ne 0) {throw 'Falha no electron-builder. Envie a mensagem exibida no PowerShell.'}
Write-Host 'Concluido! Confira a pasta dist.' -ForegroundColor Green
Get-ChildItem (Join-Path $root 'dist') -Filter '*Setup*.exe' | Select-Object -ExpandProperty FullName

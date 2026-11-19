# Souz Pro Lyric v0.2 - build no Windows (PowerShell comum).
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sdk = Join-Path $root 'vendor\Spout2'
$native = Join-Path $root 'native'
$out = Join-Path $native 'build\Release'
if (!(Test-Path $sdk)) {
  New-Item -ItemType Directory -Force (Split-Path $sdk) | Out-Null
  git clone --depth 1 https://github.com/leadedge/Spout2.git "$sdk"
  if ($LASTEXITCODE -ne 0) {throw 'Falha clonando o SDK Spout2'}
}
cmake -S "$sdk" -B "$sdk\BUILD" -A x64 -DSPOUT_BUILD_SPOUTDX=ON
if ($LASTEXITCODE -ne 0) {throw 'Falha configurando SDK Spout2'}
cmake --build "$sdk\BUILD" --config Release
if ($LASTEXITCODE -ne 0) {throw 'Falha compilando SDK Spout2'}
$lib = Get-ChildItem -Path "$sdk\BUILD" -Filter 'SpoutDX.lib' -Recurse -File |
  Where-Object {$_.FullName -match 'Release'} | Select-Object -First 1
if (!$lib) {throw 'SpoutDX.lib nao localizada. Confira a compilacao do SDK.'}
cmake -S "$native" -B "$native\build" -A x64 "-DSPOUT_ROOT=$sdk" "-DSPOUT_DX_LIB=$($lib.FullName)"
if ($LASTEXITCODE -ne 0) {throw 'Falha configurando emissor'}
cmake --build "$native\build" --config Release
if ($LASTEXITCODE -ne 0) {throw 'Falha compilando emissor'}
New-Item -ItemType Directory -Force "$out" | Out-Null
$dll = Get-ChildItem -Path "$sdk\BUILD" -Filter 'SpoutDX.dll' -Recurse -File |
  Where-Object {$_.FullName -match 'Release'} | Select-Object -First 1
if ($dll) { Copy-Item "$($dll.FullName)" "$out\SpoutDX.dll" -Force }
if (!(Test-Path "$out\souz-spout-sender.exe")) {throw 'Executavel nao encontrado na pasta esperada'}
Write-Host 'Compilacao concluida. A DLL SpoutDX foi copiada quando encontrada.' -ForegroundColor Green
Write-Host 'Proximo comando: npm start'

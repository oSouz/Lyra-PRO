$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$dest=Join-Path $root "backup-dados-antes-instalacao-$stamp"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
$folders=@(
  (Join-Path $env:APPDATA 'Lyra'),
  (Join-Path $env:APPDATA 'Souz Pro Lyric'),
  (Join-Path $env:APPDATA 'souz-pro-lyric-desktop'),
  (Join-Path $env:LOCALAPPDATA 'Souz Pro Lyric'),
  (Join-Path $env:LOCALAPPDATA 'souz-pro-lyric-desktop')
)
$found=0
foreach($folder in $folders) {
  if(Test-Path $folder) {
    $found++
    $name=('{0}-{1}' -f $found, (Split-Path $folder -Leaf))
    Copy-Item -LiteralPath $folder -Destination (Join-Path $dest $name) -Recurse -Force
    Write-Host "Backup: $folder" -ForegroundColor Green
  }
}
Write-Host "Backup concluido em: $dest" -ForegroundColor Cyan
if ($found -eq 0) { Write-Warning 'Nenhuma pasta de dados padrao encontrada. Verifique se musicas e configuracoes estao salvas em outro local antes de instalar.' }

# Souz Pro Lyric v0.6.1 — preparar instalador Windows

Este pacote contém o projeto completo, configurado para produzir um instalador NSIS `.exe` no **Windows x64**. Ele **não contém um Setup.exe pronto**: o instalador precisa ser gerado no computador Windows, incluindo os binários Spout2 já compilados.

## Segurança antes da atualização

1. **Não desinstale** o Souz Pro Lyric instalado nem apague sua versão funcional.
2. Feche o aplicativo e execute, no PowerShell aberto na pasta deste projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-dados.ps1
```

O programa guarda músicas e configurações via `localStorage`. Esse backup copia os diretórios de dados mais comuns, mas não garante que cubra perfis personalizados. Confirme que suas músicas importantes estão preservadas antes de instalar.

## Gerar Setup.exe

Copie esta pasta para o Windows, abra o PowerShell na pasta que contém `package.json` e execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\criar-instalador.ps1 -OrigemSpout "C:\CAMINHO\DO\PROJETO-QUE-FUNCIONA"
```

A opção `-OrigemSpout` aceita tanto a pasta raiz de um projeto com `native\build\Release` quanto a própria pasta `Release`, desde que contenha `souz-spout-sender.exe` e `SpoutDX.dll`. Se os dois arquivos já estiverem em `native\build\Release` desta pasta, execute sem `-OrigemSpout`.

O script verifica os binários, roda `npm run check`, instala dependências de construção, confirma a existência do Electron e gera `dist\Lyra-Setup-0.6.1-x64.exe` (nome previsto pelo empacotador).

**Se o Electron não baixar corretamente**, como já ocorreu neste computador, verifique a versão realmente instalada com `node -p "require('./node_modules/electron/package.json').version"` e utilize o pacote oficial correspondente ao valor retornado. Não extraia uma versão diferente sem ajustar as dependências.

## Testar sem substituir sua instalação atual

O instalador é configurado para permitir escolher o diretório da instalação. Para uma primeira validação, recomenda-se escolher uma pasta diferente, por exemplo `Souz Pro Lyric TESTE 0.6.1`, e testar a fonte Spout2 no Resolume.

**Atenção:** instalar outra versão do mesmo aplicativo pode atualizar os atalhos ou o registro de desinstalação do Windows, dependendo da identidade do instalador antigo. Não foi possível confirmar a identidade da versão anteriormente instalada, portanto não há garantia de atualização direta no mesmo local.

Só depois de confirmar que letras, transições, Grid Scroll e monitor funcionam, planeje substituir a instalação anterior. Não copie arquivos diretamente para `AppData\Local\Programs\Souz Pro Lyric`.

## O que foi alterado no código

- Adicionado empacotamento Electron Builder com NSIS x64.
- Em modo instalado, o transmissor é procurado em `resources\native\souz-spout-sender.exe`, com `SpoutDX.dll` na mesma pasta.
- Em modo desenvolvimento, o caminho original `native\build\Release` permanece.
- O HTML, animações, presets e Grid Scroll da v0.6.1 **não foram modificados**.

## Limites da validação

O pacote foi inspecionado e o JavaScript foi verificado estaticamente. O Setup.exe não pode ser gerado nem testado neste ambiente Linux, e a atualização sobre o instalador antigo ainda depende de verificação em Windows.

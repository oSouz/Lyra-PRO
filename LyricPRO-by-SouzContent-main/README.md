# Correção da v0.4 — efeitos de entrada/saída no Resolume

**Correções:** a animação por linha agora usa o seletor correto para o elemento `.ln.live.u`; e a janela offscreen recebe `transition.leave` para executar o efeito de saída antes de desenhar a linha seguinte. Também foi removido o envio inicial duplicado de estado durante a inicialização da saída.

**Atualização recomendada, sem reinstalar Electron nem recompilar Spout2:** com o Souz Pro Lyric v0.3 fechado, copie os arquivos `main.cjs` e `app\souz-pro-lyric.html` desta v0.4 para as mesmas posições da pasta da v0.3 que já funciona. Substitua quando o Windows perguntar. Abra o PowerShell na pasta v0.3 e rode `npm start`. Esse processo preserva o Electron 39.8.10 que você instalou manualmente e seu transmissor compilado. Para facilitar, execute `scripts\apply-to-v0.3.ps1` desta v0.4 (veja abaixo).

**Teste:** na v0.3 atualizada, selecione *Dividir: Linha* e *Entrada: Subir*, *Saída: Suave*, depois alterne entre duas linhas consecutivas. No Resolume, deve aparecer o efeito de saída da linha antiga e o efeito de entrada da nova. Repita com *Dividir: Palavra* e *Dividir: Letra*.

**Limitação:** o patch foi checado estaticamente; comportamento no Electron/Resolume Windows depende de teste no computador do usuário.

---

# Souz Pro Lyric Desktop — v0.4 (Windows + Spout2)

Esta versão preserva o HTML completo, inclusive **Grid Scroll**, espaçamento entre palavras, efeitos de texto e Bandeira. A transmissão nativa via Spout2 continua um **protótipo de validação em Windows**; não foi testada no Resolume nesta sessão.

## Objetivo desta versão

Separar duas possíveis causas do erro *"a fonte não aparece nas Sources do Resolume"*:

- **Teste A — SDK / placa de vídeo / descoberta Spout:** o `souz-spout-sender.exe` publica um **padrão de teste nativo**, independente de Electron e do HTML, com o nome `SOUZ_TESTE`.
- **Teste B — captura do Electron / pipe / saída do aplicativo:** o Souz Pro Lyric publica os quadros do palco com o nome `Souz Pro Lyric`.

Os dois testes compartilham a biblioteca SpoutDX, mas apenas o Teste B envolve o Electron.

## Requisitos

Windows x64, Git, CMake, Visual Studio 2022 com ferramentas C++/MSVC e Windows SDK, Node.js/npm. Resolume Arena rodando **no mesmo Windows e sessão do usuário**. Seu ambiente já identificou anteriormente MSVC 14.44 e SDK 10.0.26100.0.

## Instalar e abrir (um comando)

1. Extraia o ZIP numa **pasta nova**, sem substituir a v0.2.
2. Abra o PowerShell comum na pasta `souz-pro-lyric-desktop`.
3. Execute:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\install-and-run.ps1
   ```

O script compila o SDK e o transmissor, copia `SpoutDX.dll`, executa `npm install`, verifica o JavaScript/HTML e abre o aplicativo. O SDK é obtido do repositório oficial `leadedge/Spout2` (não é incluído no ZIP).

Se já compilou e instalou tudo, poderá usar `npm start`.

## Teste A — transmissor nativo sem Electron (faça PRIMEIRO)

1. Encerre a transmissão Spout dentro do Souz Pro Lyric (pode fechar o aplicativo).
2. Na raiz do projeto, execute:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\test-spout.ps1
   ```

3. **Deixe o PowerShell executando**. O programa publica a fonte `SOUZ_TESTE` (1280×720) com faixas coloridas e transparência. Mensagens esperadas: `SOUZ_INIT`, `SOUZ_READY`, `SOUZ_STATS`.
4. No Resolume Arena, abra **Sources → Spout** e procure **SOUZ_TESTE**. Arraste para uma camada para visualizar.
5. Pare com `Ctrl+C` após observar o resultado.

**Interpretação:**

- `SOUZ_READY` + `SOUZ_TESTE` visível: transmissor Spout nativo e descoberta pelo Resolume funcionam. Avance para o Teste B.
- `SOUZ_ERROR ...`: falha no DirectX/Spout; envie a linha exata.
- `SOUZ_READY`, mas `SOUZ_TESTE` não aparece: investigar primeiro integração de GPU/sessão e configurações de Spout/Resolume, não o Electron.
- Não existe `SOUZ_READY`: o teste nativo ainda não publicou a primeira imagem.

## Teste B — Souz Pro Lyric enviando as letras

1. Feche o teste A com `Ctrl+C`.
2. Execute `npm start` na raiz do projeto (se o instalador não estiver aberto).
3. Escolha uma música e uma linha. Clique em **Iniciar Spout2**.
4. Acompanhe o PowerShell do `npm start`:

   - `Saída invisível carregada`: HTML de saída iniciado.
   - `Palco de saída sincronizado`: recebeu a confirmação inicial do HTML.
   - `Primeiro quadro capturado e entregue ao pipe`: o Electron escreveu bytes na fila do processo; não garante processamento.
   - `SOUZ_FRAME`: o C++ recebeu um quadro BGRA completo.
   - `SOUZ_READY`: o primeiro `SendImage()` retornou sucesso.
   - `Diagnóstico: paint=N; enviado=N; saída pronta=true; Spout pronto=true`: contador das etapas.

5. No Resolume, procure `Souz Pro Lyric` em **Sources → Spout**.

**Se o Teste A funciona mas o B não:** copie as linhas `[SOUZ]` e `[SPOUT NATIVE]`. O fluxo ainda pode falhar no papel da janela, no evento `paint` ou na transferência via pipe.

## Limitações e cuidados

- **Não foi gerado um executável Windows aqui**: a compilação do C++/SDK requer o Windows e o Visual Studio instalados no seu computador.
- **Não foi confirmada a chegada do alfa no Resolume**, nem desempenho real. `SOUZ_READY` confirma apenas que `SendImage` retornou sucesso, não que o Resolume exibiu o vídeo.
- Este protótipo usa bitmap BGRA copiado pela CPU, **1920×1080 a até 30 FPS**. Para produção em 60 FPS/4K, a próxima etapa é a integração por textura GPU compartilhada.
- A saída do aplicativo usa fundo transparente forçado para o Electron, mas nuances de alfa premultiplicado precisam ser conferidas sobre um vídeo no Resolume.
- O SDK é distribuído sob licença BSD-2-Clause; preserve os avisos de licença ao redistribuir binários.

## Arquivos

- `main.cjs`: janela de controle, janela offscreen e pipe de vídeo.
- `preload.cjs`: ponte IPC.
- `app/souz-pro-lyric.html`: HTML completo, efeitos e interface.
- `native/souz-spout-sender.cpp`: emissor Spout2 BGRA com `--test-pattern`.
- `native/CMakeLists.txt`: compilação do transmissor.
- `scripts/build-spout.ps1`: SDK, compilação, cópia da DLL.
- `scripts/test-spout.ps1`: teste isolado do SDK/Resolume.
- `scripts/install-and-run.ps1`: preparação em um comando.
- `scripts/check-project.cjs`: verificação sintática e marcadores do projeto.

Fontes técnicas: https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering e https://github.com/leadedge/Spout2.

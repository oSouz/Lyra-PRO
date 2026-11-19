# ProPresenter Bridge para Lyra PRO

O ZIP original contém o Souz Pro Lyric v0.6.1, um app Electron com interface
HTML/CSS/JavaScript e emissor Spout2 em C++/Direct3D 11. O código extraído e o
Bridge estão em [LyricPRO-by-SouzContent-main](LyricPRO-by-SouzContent-main).
O arquivo ZIP permanece como referência da versão original.

## Mac Studio · ProPresenter 7

1. Abra **ProPresenter → Settings → Network**. Ative **Enable Network** e
   anote o endereço IP e a porta HTTP indicados nessa tela. A porta 1025 é
   apenas um exemplo. Prefira Ethernet na rede local de produção.
2. Coloque um slide com letra no ar e deixe outro na sequência.
3. No Windows, confirme que a API responde. Substitua o IP e a porta pelo
   endereço exibido no Mac.

   ```powershell
   curl.exe --fail --max-time 3 http://192.168.1.20:1025/v1/status/slide
   ```

   Confira os campos `current.text` e `next.text`. Se a chamada falhar, confira
   a porta, a comunicação entre os computadores e o firewall do Mac. Em caso
   de HTTP 404, confira a documentação de API na versão instalada.

[Configuração de rede do ProPresenter](https://support.renewedvision.com/hc/en-us/articles/6024791423763-Connecting-to-ProPresenter-Control) · [API oficial](https://openapi.propresenter.com/)

## Windows · Lyra PRO e Resolume Arena

Para abrir a prévia a partir do código, instale Node.js 22+ e Git. Para
compilar o Spout2, instale também CMake e Visual Studio 2022 Build Tools com
**Desktop development with C++** e Windows SDK. Abra um PowerShell na raiz
do repositório.

```powershell
cd LyricPRO-by-SouzContent-main
npm install
npm run check
npm test
powershell -ExecutionPolicy Bypass -File scripts/build-spout.ps1
npm start
```

A prévia funciona mesmo antes de compilar o emissor. Se o npm bloquear o
script de instalação do Electron, execute `node node_modules/electron/install.js`
antes de iniciar o aplicativo.

1. No Lyra, abra **ProPresenter Bridge**, informe `IP:porta` e clique em
   **Conectar**. O palco mostra o slide atual e o painel mostra o próximo.
   **Desconectar** volta ao modo manual.
2. Clique em **Iniciar Spout2** e aguarde a confirmação do emissor. A saída
   usa a fonte **Lyra**, em 1920 × 1080.
3. No Arena, arraste essa fonte de **Sources** para um clipe em uma camada
   acima do fundo, acione o clipe e confira a transparência, inclusive nas
   bordas do texto. Use a mesma GPU para os dois aplicativos.
4. Teste avanço normal, salto para um slide inesperado, slide sem letra e
   perda/restabelecimento da conexão. Em falha da API o Bridge limpa a
   saída assim que detecta o erro e tenta reconectar automaticamente.
   Confirme também o comportamento de **Clear All** na versão do Mac.
   O Bridge espelha o texto retornado pela API.

[Fontes no Resolume](https://resolume.com/support/sources) · [Spout2 SDK](https://github.com/leadedge/Spout2)

## Latência e escopo

A leitura é feita exclusivamente com `GET /v1/status/slide`. Há uma consulta
por vez, com intervalo nominal de 50 ms entre inícios quando o servidor
responde em menos de 50 ms. O Bridge só publica alterações. Ele prepara o
texto do próximo slide em uma camada oculta e a torna visível quando a API
confirma a troca. Em um salto, atualiza o texto direto. O MVP usa texto
branco estático com quebras de linha. Efeitos e configurações de aparência
para a fonte de rede ficam para outra etapa.

Os 50 ms são a cadência de consulta, não o atraso total. A medição em
produção deve incluir a rede, o tempo de resposta da API, a renderização, o
emissor Spout e a composição no Resolume. Filme o acionamento no Mac e a
saída do Arena no mesmo enquadramento, conte os quadros entre os eventos e
repita com avanços e saltos para obter as latências típica e de pior caso
observado. O teste automatizado usa um servidor HTTP simulado na máquina
local.

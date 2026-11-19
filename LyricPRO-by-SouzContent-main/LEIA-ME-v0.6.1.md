# Souz Pro Lyric Desktop v0.6.1 — Medição confiável

Esta atualização **não modifica o algoritmo do Grid Scroll nem as animações**. O fluxo de vídeo para o Resolume foi preservado.

## O que cada número realmente significa

- **Captura**: eventos `paint` recebidos do Chromium na janela de saída invisível, por segundo. Não mede o FPS da interface principal.
- **Pipe**: escritas de pacotes concluídas pela API de stdin do transmissor, por segundo. Não confirma que o Resolume exibiu cada quadro.
- **Spout**: taxa calculada a partir dos contadores de sucesso de `SendImage()` emitidos pelo processo C++. Se o binário antigo ainda não publicou duas amostras, aparece `—` (sem dado), jamais um número presumido.
- **Descartes**: total acumulado desde o início da transmissão, incluindo limite de cadência, pipe ocupado e quadros inválidos. É normal haver descartes por limite de cadência quando há capturas acima da meta; não equivale necessariamente a engasgos.
- Passe o mouse sobre os indicadores para ver o detalhamento, inclusive tempo médio de preparação de quadros.

A exibição usa taxa medida entre amostras; portanto pode oscilar e não garante 60 FPS. Os valores não medem o FPS efetivamente exibido pelo Resolume.

## Atualização recomendada no Windows (sem reinstalar Electron)

1. **Faça backup** e feche o aplicativo.
2. Descompacte o pacote, abra PowerShell na pasta extraída e execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-to-v0.6.ps1 -Destino "C:\CAMINHO\DA\SUA\PASTA\souz-pro-lyric-master-v0.6"
```

O script cria um backup de `main.cjs`, `app\souz-pro-lyric.html` e `native\souz-spout-sender.cpp`, e copia as versões v0.6.1. Ele **não apaga `node_modules` nem o transmissor já compilado**.

3. Rode `npm run check` e `npm start` **na pasta da v0.6 atualizada**. Confira a transmissão ao Resolume.
4. **Opcional para obter dados nativos a cada segundo**: compile `native\souz-spout-sender.cpp` pelo script `scripts\build-spout.ps1` com os requisitos já instalados. Isso substitui o executável; **faça uma cópia de segurança do EXE e da DLL antes de compilar**. Sem recompilar, as métricas nativas podem ficar indisponíveis nos primeiros segundos ou mudar mais lentamente (o EXE antigo informa a cada 150 quadros).

### Teste funcional

Com Grid Scroll ativo, compare Captura, Pipe e Spout. Se a animação está fluida, não faça ajustes apenas porque o FPS mostrado está abaixo de 60. Desative e reative o Spout2 e confira a recuperação dos indicadores. Teste entrada, saída e transparência.

**Validação neste ambiente:** sintaxe e estrutura de arquivos podem ser verificadas; C++/Spout2 e performance real exigem Windows e Resolume. Não substitua sua cópia estável antes dos testes.

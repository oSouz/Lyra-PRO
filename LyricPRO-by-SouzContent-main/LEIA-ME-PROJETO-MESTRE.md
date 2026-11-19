# Souz Pro Lyric — Projeto-mestre v0.6

## Conteúdo
- Base completa v0.4: interface, Spout2 C++, scripts, Electron e correção das entradas/saídas.
- HTML da atualização v0.5: controle independente de fonte do Grid Scroll, 2–400 px.
- Atualização v0.6: captura com meta 60 FPS, telemetria e recuperação do transmissor.

## Importante
Este ZIP contém os **arquivos-fonte completos** do projeto consolidado, não inclui `node_modules`, SDK Spout2 baixado, DLL, nem os executáveis Windows compilados.
A v0.6 foi validada por checagens estáticas neste ambiente; não houve teste do projeto consolidado no Resolume/Windows. Para preservar seu aplicativo já funcional, faça uma cópia da pasta instalada antes de substituir arquivos.

## Usar sem perder sua instalação funcionando
1. **Guarde uma cópia** da pasta funcional do Windows, inclusive `native\build` e `node_modules`.
2. Abra o novo ZIP em uma pasta separada. Não faça uma instalação limpa do Electron se a versão instalada já funciona.
3. Para atualizar a instalação existente sem mexer no Electron/Spout compilado, copie **somente** os arquivos `main.cjs`, `preload.cjs` e `app\souz-pro-lyric.html` deste pacote para a pasta funcional, preservando previamente backups.
4. No PowerShell da pasta funcional: `npm start`.
5. Confirme efeitos de entrada/saída, Grade/Grid Scroll, Spout2 e métricas no Resolume.

## Se precisar compilar do zero
Leia `README.md`. Dependências nativas devem ser compiladas no Windows com VS Build Tools, CMake e Spout2. O download do executável Electron pode exigir reparo do pacote no Windows.

## Limites
A meta de 60 FPS não garante desempenho sustentado. A saída ainda utiliza cópia de quadros CPU→processo nativo, e testes reais de transparência, estabilidade e performance são necessários no Windows.

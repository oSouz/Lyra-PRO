'use strict';
// Verificação estática local sem Electron/Windows.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app','souz-pro-lyric.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if(!scripts.length) throw new Error('Nenhum script inline no HTML.');
for(const [i,m] of scripts.entries())new vm.Script(m[1],{filename:`html-script-${i}.js`});
for(const marker of ['gridscroll','gridWordGap','souzDesktop','outputReady']) {
  if(!html.includes(marker)) throw new Error(`Marcador esperado ausente: ${marker}`);
}
const source=fs.readFileSync(path.join(root,'native','souz-spout-sender.cpp'),'utf8');
if(!source.includes('--test-pattern')||!source.includes('SOUZ_READY'))throw new Error('Teste nativo ou telemetria ausente.');
console.log(`OK: HTML (${scripts.length} scripts), integração desktop, Grid Scroll e teste nativo presentes.`);

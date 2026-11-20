'use strict';
const {app, BrowserWindow, ipcMain, shell, dialog} = require('electron');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {findRelease, downloadInstaller, verifyInstaller} = require('./updates.cjs');
const path = require('node:path');
const fs = require('node:fs');
const {performance} = require('node:perf_hooks');
const {slideEndpoint, followSlides} = require('./propresenter-bridge.cjs');

// v0.6.1: telemetria por etapa (captura, pipe, Spout nativo); efeitos preservados.
const SIZE = {width:1920,height:1080};
const FPS = 60;
const SPOUT_NAME = 'Lyra';

// Existing installations can keep using the library in their original data folder.
const legacyUserData = path.join(app.getPath('appData'), 'Souz Pro Lyric');
if (!fs.existsSync(app.getPath('userData')) && fs.existsSync(legacyUserData)) {
  app.setPath('userData', legacyUserData);
}
const FRAME_MS = Math.round(1000 / FPS);
// Em desenvolvimento: native/build/Release. Instalado: resources/native.
const senderPath = app.isPackaged
  ? path.join(process.resourcesPath, 'native', 'souz-spout-sender.exe')
  : path.join(__dirname, 'native', 'build', 'Release', 'souz-spout-sender.exe');
const asset = path.join(__dirname,'app','souz-pro-lyric.html');
let control = null, output = null, sender = null;
let lastState = null, outReady = false, stopping = false;
let paintTimer = null, busy = false, writable = false, lastFrame = 0;
let captureCount = 0, sentCount = 0, sizeWarning = false, firstSent = false;
let lastStatus = '';
let nativeReady = false;
let desiredSpout = false;
let restartTimer = null;
let restartAttempts = 0;
const MAX_RESTARTS = 3;
let statsPrev = {paint:0,sent:0,at:Date.now()};
let droppedPaint = 0;
let nativeFrames = 0;
let senderSerial = 0;
// Contadores cumulativos desde o início da transmissão.
let pipeCompleted = 0;
let drops = {cadence:0,backpressure:0,invalid:0};
let prepMsTotal = 0, prepSamples = 0;
let nativeSample = null; // SOUZ_STATS recebido do executável nativo
let nativeSamplePrev = null;
let nativeFps = null, nativeReportAgeMs = null;
let nativeWriteMs = null;
let prevMetrics = {paint:0,queued:0,completed:0,at:Date.now()};
function emitMetrics(){
  const now = Date.now();
  const seconds = Math.max(.001,(now-prevMetrics.at)/1000);
  nativeReportAgeMs = nativeSample ? now-nativeSample.at : null;
  // A versão antiga do transmissor informa frames a cada 150 quadros.
  // Nunca apresentar uma amostra antiga como FPS instantâneo.
  const nativeFresh = nativeReportAgeMs!==null && nativeReportAgeMs<8000;
  const metrics = {
    active:!!sender,ready:nativeReady,outputReady:outReady,targetFps:FPS,
    captureFps:Math.round((captureCount-prevMetrics.paint)/seconds),
    queueFps:Math.round((sentCount-prevMetrics.queued)/seconds),
    pipeFps:Math.round((pipeCompleted-prevMetrics.completed)/seconds),
    nativeFps:nativeFresh?nativeFps:null,
    nativeAgeMs:nativeReportAgeMs,
    nativeFrames, nativeWriteMs:nativeFresh?nativeWriteMs:null,
    drops:{...drops},
    dropped:drops.cadence+drops.backpressure+drops.invalid,
    prepMs:prepSamples?Math.round(prepMsTotal/prepSamples*10)/10:null,
    resolution:`${SIZE.width}×${SIZE.height}`,
    restarts:restartAttempts
  };
  prevMetrics={paint:captureCount,queued:sentCount,completed:pipeCompleted,at:now};
  prepMsTotal=0;prepSamples=0;
  if(control && !control.isDestroyed()) control.webContents.send('souz:metrics',metrics);
}
function receiveNativeStats(msg){
  const frameMatch=msg.match(/\bframes=(\d+)/);
  if(!frameMatch)return;
  const now=Date.now();
  const frames=Number(frameMatch[1]);
  if(nativeSamplePrev && frames>=nativeSamplePrev.frames){
    const deltaSec=(now-nativeSamplePrev.at)/1000;
    if(deltaSec>0.1)nativeFps=Math.round((frames-nativeSamplePrev.frames)/deltaSec*10)/10;
  }
  const sendMatch=msg.match(/\bsend_ms=([\d.]+)/);
  nativeWriteMs=sendMatch?Number(sendMatch[1]):null;
  nativeSample={frames,at:now};
  nativeSamplePrev=nativeSample;
  nativeFrames=frames;
}
function scheduleRestart(){
  if(!desiredSpout || stopping || restartTimer || restartAttempts>=MAX_RESTARTS) {
    if(restartAttempts>=MAX_RESTARTS) {
      desiredSpout=false;
      report('Spout2 interrompido. Reinicie pelo botão para tentar novamente.',false);
    }
    return;
  }
  restartAttempts++;
  const attempt=restartAttempts, delay=Math.min(1000*2**(attempt-1),5000);
  report(`Spout2 interrompido. Recuperação automática ${attempt}/${MAX_RESTARTS} em ${delay/1000}s.`,false);
  restartTimer=setTimeout(()=>{
    restartTimer=null;
    if(desiredSpout && !sender) startSender();
  },delay);
}


function report(message, active = !!sender) {
  lastStatus = message;
  publishUpdateState();
  console.log('[SOUZ]', message);
  if (control && !control.isDestroyed()) {
    control.webContents.send('souz:status', {active, ready:active&&nativeReady, requested:desiredSpout, message});
  }
}
let bridgeConnection;
let bridgeState = null;

function publishBridge(state) {
  bridgeState = state;
  publishUpdateState();
  if (control && !control.isDestroyed()) control.webContents.send('souz:bridge-state', state);
  if (outReady && output && !output.isDestroyed()) {
    output.webContents.send('souz:bridge-state', state);
  }
}

function stopBridge() {
  bridgeConnection?.abort();
  bridgeConnection = undefined;
}

function createControl() {
  control = new BrowserWindow({
    width:1440,height:900,minWidth:1000,minHeight:650,backgroundColor:'#111111',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false}
  });
  control.webContents.on('did-finish-load', () => {
    control.webContents.send('souz:status',{active:!!sender,ready:!!sender&&nativeReady,requested:desiredSpout,message:lastStatus||'Spout desligado'});
    control.webContents.send('souz:bridge-state', bridgeState);
  });
  control.webContents.setWindowOpenHandler(({url}) => {
    if (url === 'https://github.com/oSouz/Lyra-PRO/tree/feature/propresenter-bridge') {
      shell.openExternal(url).catch(error => console.error('[LYRA]', error.message));
    }
    return {action:'deny'};
  });
  control.loadFile(asset);
  control.on('closed', () => {
    control=null;
    stopBridge();
    bridgeState=null;
    stopSender();
    if (output && !output.isDestroyed()) output.close();
  });
}
function stopPaintTimer() {
  if (paintTimer) {clearInterval(paintTimer);paintTimer=null;}
}
function closeOutput() {
  stopPaintTimer();
  if (output && !output.isDestroyed()) output.close();
  output=null;outReady=false;
}
function sendFrame(image) {
  if (!sender || !writable || busy || !sender.stdin || sender.stdin.destroyed) {drops.backpressure++;return;}
  const now = Date.now();
  if (now-lastFrame < FRAME_MS-2) {drops.cadence++;return;}
  const prepStart=performance.now();
  let size=image.getSize();
  if (size.width !== SIZE.width || size.height !== SIZE.height) {
    if (!sizeWarning) {
      sizeWarning=true;
      report(`Quadro recebido em ${size.width}x${size.height}; adaptando para 1920x1080 (escala de tela).`);
    }
    image=image.resize({width:SIZE.width,height:SIZE.height,quality:'best'});
    size=image.getSize();
  }
  const pixels=image.toBitmap();
  const expected=SIZE.width*SIZE.height*4;
  if (pixels.length !== expected) {
    drops.invalid++;
    report(`Frame rejeitado: ${pixels.length} bytes (esperado ${expected}).`);
    return;
  }
  const header=Buffer.allocUnsafe(12);
  header.writeUInt32LE(SIZE.width,0);
  header.writeUInt32LE(SIZE.height,4);
  header.writeUInt32LE(expected,8);
  const packet=Buffer.concat([header,pixels]);
  prepMsTotal+=performance.now()-prepStart;prepSamples++;
  busy=true;
  lastFrame=now;
  sentCount++;
  if (!firstSent) {
    firstSent=true;
    report('Primeiro quadro capturado e entregue ao pipe; aguardando confirmação Spout2.');
  }
  try {
    const canWrite=sender.stdin.write(packet,(err) => {
      busy=false;
      if (!err) pipeCompleted++;
      if (err && !stopping) report('Falha no pipe de vídeo: '+err.message,false);
    });
    if (!canWrite) writable=false;
  } catch(e) {
    busy=false;writable=false;
    report('Erro enviando frame: '+e.message,false);
  }
}
function createOutput() {
  if (output && !output.isDestroyed()) return;
  outReady=false;
  output=new BrowserWindow({
    show:false,frame:false,transparent:true,backgroundColor:'#00000000',
    width:SIZE.width,height:SIZE.height,resizable:false,useContentSize:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--souz-output'],
      offscreen:{useSharedTexture:false},backgroundThrottling:false,
      contextIsolation:true,nodeIntegration:false,sandbox:false}
  });
  output.webContents.setFrameRate(FPS);
  output.webContents.on('paint', (_event,_dirty,image) => {
    if (!outReady || image.isEmpty()) return;
    captureCount++;
    sendFrame(image);
  });
  output.webContents.on('did-fail-load', (_e,code,description) => report(`Falha carregando saída: ${code} ${description}`,false));
  output.webContents.on('render-process-gone', (_e,details) => report('Renderização da saída terminou: '+details.reason,false));
  output.webContents.on('did-finish-load', () => {
    report('Saída invisível carregada; aguardando sincronização do palco.');
    // O estado inicial será enviado após o aviso souz:output-ready, uma única vez.
    output.webContents.startPainting();
    output.webContents.invalidate();
    // Em offscreen o Chromium não gera frames se a página estiver estática.
    // Solicitar um repaint garante presença do sender mesmo na tela vazia.
    stopPaintTimer();
    paintTimer=setInterval(() => {
      if (!output || output.isDestroyed() || !sender) return;
      output.webContents.invalidate();
    }, FRAME_MS);
  });
  output.loadFile(asset);
  output.on('closed',()=>{stopPaintTimer();output=null;outReady=false;});
}
function stopSender() {
  desiredSpout=false;
  nativeReady=false;
  stopping=true;
  if(restartTimer){clearTimeout(restartTimer);restartTimer=null;}
  restartAttempts=0;
  writable=false;busy=false;
  if (sender) {
    const proc=sender;sender=null;
    if (proc.stdin && !proc.stdin.destroyed) proc.stdin.end();
    setTimeout(()=>{if(proc.exitCode===null && !proc.killed) proc.kill();},1500).unref();
  }
  closeOutput();
  report('Spout desligado',false);
}
function startSender() {
  if (sender) return {active:true,message:lastStatus||'Spout em execução'};
  if (process.platform!=='win32') return {active:false,message:'Spout2 funciona apenas no Windows'};
  if (!fs.existsSync(senderPath)) return {active:false,message:'Emissor não encontrado. Compile via scripts/build-spout.ps1'};
  desiredSpout=true;stopping=false;busy=false;writable=true;
  firstSent=false;nativeReady=false;sizeWarning=false;
  captureCount=0;sentCount=0;pipeCompleted=0;drops={cadence:0,backpressure:0,invalid:0};
  lastFrame=0;nativeFrames=0;nativeSample=null;nativeSamplePrev=null;nativeFps=null;nativeWriteMs=null;
  prepMsTotal=0;prepSamples=0;
  prevMetrics={paint:0,queued:0,completed:0,at:Date.now()};
  const proc=spawn(senderPath,[String(SIZE.width),String(SIZE.height),SPOUT_NAME],{
    windowsHide:true,stdio:['pipe','ignore','pipe']
  });
  sender=proc;
  const serial=++senderSerial;
  report(`Emissor iniciado (PID ${proc.pid||'pendente'}), aguardando primeiro quadro.`);
  let errors='';
  let pendingLine='';
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', chunk => {
    if(sender!==proc)return;
    errors=(errors+chunk).slice(-1500);
    pendingLine+=chunk;
    const lines=pendingLine.split(/\r?\n/);
    pendingLine=lines.pop() || '';
    for (const line of lines) {
      const msg=line.trim();
      if (!msg) continue;
      console.log('[SPOUT NATIVE]',msg);
      if (msg.startsWith('SOUZ_READY')) {nativeReady=true;restartAttempts=0;report(`Spout2 ativo. Fonte ${SPOUT_NAME} disponível no Resolume.`);}
      else if (msg.startsWith('SOUZ_FRAME')) report('Spout2 recebeu o primeiro quadro; iniciando envio à GPU.');
      else if (msg.startsWith('SOUZ_STATS')) receiveNativeStats(msg);
      else if (msg.startsWith('SOUZ_ERROR')) report('Erro nativo: '+msg,false);
    }
  });
  proc.stdin.on('drain',()=>{if(sender===proc)writable=true;});
  proc.stdin.on('error',e=>{if (!stopping) report('Pipe Spout: '+e.message,false);});
  proc.on('error',e=>{if(sender!==proc)return;sender=null;nativeReady=false;scheduleRestart();report('Falha ao iniciar Spout: '+e.message,false);});
  proc.on('exit',(code,signal)=>{
    if(serial!==senderSerial || sender!==proc) return;
    sender=null;
    nativeReady=false;
    writable=false;busy=false;stopPaintTimer();
    if (!stopping) {
      report(`Emissor encerrou (${code??signal}). ${errors.slice(-350)}`,false);
      closeOutput();
      scheduleRestart();
    }
  });
  createOutput();
  return {active:true,message:lastStatus};
}
let updatePhase = 'idle', updateMessage = 'Consulte o canal de atualizações.';
let release, installer, updateProgress, lastUpdateState;
let installing = false;

function updateBlock() {
  if (!app.isPackaged) return 'A instalação de atualizações está disponível no Lyra instalado.';
  if (desiredSpout || sender) return 'Pare o Spout2 para instalar a atualização.';
  if (lastState?.cleanOutput || (!lastState?.letterCleared &&
      (bridgeState ? bridgeState.current.trim() : lastState?.idx >= 0 && !lastState.blank))) {
    return 'Limpe a apresentação e saia da Saída limpa antes de instalar.';
  }
  return '';
}

function updateState() {
  return {installed:app.getVersion(), available:release?.version ?? null, phase:updatePhase,
    message:updateMessage, progress:updateProgress ?? null, block:updateBlock()};
}

function publishUpdateState() {
  if (!control || control.isDestroyed()) return;
  const state = updateState();
  const serialized = JSON.stringify(state);
  if (serialized === lastUpdateState) return;
  lastUpdateState = serialized;
  control.webContents.send('souz:update-state', state);
}

function setUpdatePhase(phase, message) {
  updatePhase = phase;
  updateMessage = message;
  publishUpdateState();
}

async function runUpdate(action) {
  if (['checking','downloading','installing'].includes(updatePhase)) return updateState();
  if (action === 'check' && !installer) {
    release = undefined;
    setUpdatePhase('checking','Verificando atualizações…');
    try {
      release = await findRelease(app.getVersion());
      setUpdatePhase(release?'available':'current',release?'Atualização disponível.':'Nenhuma atualização disponível.');
    } catch (error) {
      setUpdatePhase('error',error.message);
    }
  } else if (action === 'download' && release && !installer) {
    updateProgress = 0;
    setUpdatePhase('downloading','Baixando o instalador…');
    try {
      installer = await downloadInstaller(release,app.getPath('temp'), percent => {
        updateProgress = percent;
        publishUpdateState();
      });
      setUpdatePhase('downloaded','Instalador pronto.');
    } catch (error) {
      updateProgress = undefined;
      setUpdatePhase('available',error.message);
    }
  } else if (action === 'install' && installer && !updateBlock()) {
    setUpdatePhase('installing','Confirmando instalação…');
    try {
      await verifyInstaller(installer,release.digest);
    } catch (error) {
      installer = undefined;
      updateProgress = undefined;
      setUpdatePhase('available',error.message);
      return updateState();
    }
    try {
      const answer = await dialog.showMessageBox(control,{
        type:'question',buttons:['Depois','Instalar e reiniciar'],defaultId:0,cancelId:0,
        title:'Atualizar o Lyra',message:'Instalar o Lyra '+release.version+'?',
        detail:'O Lyra será fechado, atualizado e reaberto. Suas músicas e configurações serão mantidas.'
      });
      const blocked = updateBlock();
      if (answer.response !== 1 || blocked) {
        setUpdatePhase('downloaded',blocked || 'Instalador pronto.');
        return updateState();
      }
      installing = true;
      const child = spawn(installer,['/S','--updated','--force-run'],{detached:true,stdio:'ignore',windowsHide:true});
      await once(child,'spawn');
      child.unref();
      app.quit();
    } catch (error) {
      installing = false;
      setUpdatePhase('downloaded','Falha ao abrir o instalador: '+error.message);
    }
  }
  return updateState();
}

app.whenReady().then(()=>{
  ipcMain.handle('souz:updates', (event, action) => {
    if (!control || event.sender !== control.webContents || event.senderFrame !== control.webContents.mainFrame) return;
    return runUpdate(action);
  });
  ipcMain.handle('souz:bridge', (event, address) => {
    if (!control || event.sender !== control.webContents || event.senderFrame !== control.webContents.mainFrame) {
      return {error: 'Acesso negado'};
    }
    if (installing) return {error:'O Lyra está sendo atualizado.'};
    let endpoint;
    if (address !== null) {
      try {
        endpoint = slideEndpoint(address);
      } catch {
        return {error: 'Informe o IP e a porta HTTP do Mac, por exemplo 192.168.1.20:1025.'};
      }
    }
    stopBridge();
    if (!endpoint) {
      publishBridge(null);
      return {};
    }
    bridgeConnection = new AbortController();
    const {signal} = bridgeConnection;
    publishBridge({status: 'connecting', current: '', next: ''});
    followSlides(endpoint, signal, publishBridge).catch(error => {
      if (!signal.aborted) {
        publishBridge({status: 'retrying', current: '', next: '', detail: error.message});
      }
    });
    return {};
  });
  ipcMain.on('souz:publish',(event,state)=>{
    if (!control || event.sender!==control.webContents) return;
    if (!state || typeof state!=='object' || !state.song || !state.settings) return;
    lastState=state;
    publishUpdateState();
    if(output && !output.isDestroyed() && outReady)output.webContents.send('souz:state',state);
  });
  ipcMain.on('souz:output-ready',event=>{
    if(output && event.sender===output.webContents){
      outReady=true;
      report('Palco de saída sincronizado com o operador.');
      if(lastState)output.webContents.send('souz:state',lastState);
      output.webContents.send('souz:bridge-state', bridgeState);
      output.webContents.invalidate();
    }
  });
  ipcMain.handle('souz:spout',(event,enable)=>{
    if(!control || event.sender!==control.webContents) return {active:false,message:'Acesso negado'};
    if(!enable){stopSender();return {active:false,message:'Spout desligado'};}
    if (installing) return {active:false,message:'O Lyra está sendo atualizado.'};
    return startSender();
  });
  createControl();
  if (app.isPackaged) setTimeout(()=>{if(updatePhase==='idle')runUpdate('check')},3000).unref();
  // Telemetria objetiva: distingue falta de paint, falha do pipe e falha de SendImage.
  setInterval(emitMetrics,1000).unref();
  setInterval(()=>{
    if(!sender || nativeReady) return;
    console.log('[SOUZ]',`Aguardando Spout2: paint=${captureCount}, enviados=${sentCount}, saída pronta=${outReady}`);
  },10000).unref();
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{stopBridge();stopSender();});

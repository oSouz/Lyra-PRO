'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const role = process.argv.includes('--souz-output') ? 'output' : 'control';
contextBridge.exposeInMainWorld('souzDesktop', {
  role,
  version: require('./package.json').version,
  setBridge: address => role === 'control' && ipcRenderer.invoke('souz:bridge', address),
  onBridge: fn => ipcRenderer.on('souz:bridge-state', (_event, value) => fn(value)),
  publish: state => { if(role==='control') ipcRenderer.send('souz:publish', state); },
  outputReady: () => { if(role==='output') ipcRenderer.send('souz:output-ready'); },
  onState: fn => { if(role==='output') ipcRenderer.on('souz:state', (_e, value) => fn(value)); },
  onStatus: fn => { if(role==='control') ipcRenderer.on('souz:status', (_e, value) => fn(value)); },
  onMetrics: fn => { if(role==='control') ipcRenderer.on('souz:metrics', (_e, value) => fn(value)); },
  toggleSpout: enabled => ipcRenderer.invoke('souz:spout', !!enabled)
});

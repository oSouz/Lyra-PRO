'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {test} = require('node:test');
const {readRelease, findRelease, downloadInstaller, verifyInstaller} = require('../updates.cjs');

const payload = Buffer.from('instalador simulado');
const digest = createHash('sha256').update(payload).digest('hex');
const name = 'Lyra-Setup-0.6.10-x64.exe';
const url = 'https://github.com/oSouz/Lyra-PRO/releases/download/v0.6.10/' + name;
const asset = {name,browser_download_url:url,size:payload.length,digest:'sha256:'+digest};
const release = {tag_name:'v0.6.10',assets:[asset]};

test('accepts a newer stable Lyra installer with a valid digest', () => {
  assert.equal(readRelease(release,'0.6.5').version,'0.6.10');
  assert.equal(readRelease(release,'0.6.10'),null);
  assert.equal(readRelease(release,'0.7.0'),null);
  assert.equal(readRelease({...release,prerelease:true},'0.6.5'),null);
  assert.throws(()=>readRelease({...release,assets:[{...asset,browser_download_url:'https://example.com/'}]},'0.6.5'),/verificável/);
  assert.throws(()=>readRelease({...release,assets:[{...asset,digest:null}]},'0.6.5'),/verificável/);
});

test('handles an empty channel and GitHub errors', async () => {
  assert.equal(await findRelease('0.6.5',async()=>new Response(null,{status:404})),null);
  await assert.rejects(findRelease('0.6.5',async()=>new Response(null,{status:403})),/HTTP 403/);
});

test('reports progress and rejects incomplete, altered or oversized data', async t => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'lyra-updater-test-'));
  const info=readRelease(release,'0.6.5');
  const progress=[];
  const file=await downloadInstaller(info,directory,percent=>progress.push(percent),
    async downloadUrl=>{assert.equal(downloadUrl,url);return new Response(payload);});
  assert.deepEqual(progress,[100]);
  await verifyInstaller(file,digest);
  await fs.writeFile(file,'alterado');
  await assert.rejects(verifyInstaller(file,digest),/verificação/);
  const rejectContents=bytes=>assert.rejects(downloadInstaller(info,directory,()=>{},async()=>new Response(bytes)));
  await rejectContents(payload.subarray(0,1));
  await rejectContents(Buffer.alloc(payload.length));
  await rejectContents(Buffer.alloc(payload.length+1));
  assert.deepEqual(await fs.readdir(directory),[path.basename(path.dirname(file))]);
  t.after(async()=>{await fs.unlink(file);await fs.rmdir(path.dirname(file));await fs.rmdir(directory)});
});

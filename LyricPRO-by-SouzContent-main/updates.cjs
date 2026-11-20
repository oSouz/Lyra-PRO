'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const {Transform} = require('node:stream');

const REPOSITORY = 'oSouz/Lyra-PRO';
const RELEASE_URL = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest';
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;

function readRelease(release, installed) {
  const tag = release?.tag_name;
  const next = typeof tag === 'string' && tag.match(VERSION);
  const current = installed.match(VERSION);
  if (!next || !current || release.draft || release.prerelease) return null;
  const ordered = next.slice(1).map((value, i) => Number(value) - Number(current[i+1]));
  if (!(ordered.find(delta => delta !== 0) > 0)) return null;

  const version = next.slice(1).join('.');
  const name = 'Lyra-Setup-' + version + '-x64.exe';
  const url = 'https://github.com/' + REPOSITORY + '/releases/download/' + tag + '/' + name;
  const asset = release.assets?.find(item => item.name === name && item.browser_download_url === url);
  if (!asset || !/^sha256:[0-9a-f]{64}$/i.test(asset.digest) ||
      !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 512 * 1024 * 1024) {
    throw new Error('A versão ' + version + ' não tem um instalador Windows x64 verificável.');
  }
  return {version, url, name, size: asset.size, digest: asset.digest.slice(7).toLowerCase()};
}

async function findRelease(installed, request = fetch) {
  const response = await request(RELEASE_URL, {
    headers: {Accept:'application/vnd.github+json', 'User-Agent':'Lyra-Desktop'},
    redirect: 'error', signal: AbortSignal.timeout(12000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao consultar o GitHub (HTTP ' + response.status + ').');
  return readRelease(await response.json(), installed);
}

async function downloadInstaller(release, directory, progress, request = fetch) {
  const response = await request(release.url, {signal:AbortSignal.timeout(300000)});
  if (!response.ok || !response.body) throw new Error('Falha ao baixar o instalador.');
  const folder = await fs.promises.mkdtemp(path.join(directory,'lyra-update-'));
  const file = path.join(folder,release.name);
  const digest = createHash('sha256');
  let total = 0, lastPercent = -1;
  try {
    await pipeline(response.body, new Transform({
      transform(chunk, _encoding, done) {
        total += chunk.length;
        if (total > release.size) return done(new Error('Tamanho do instalador inválido.'));
        digest.update(chunk);
        const percent = Math.floor(100 * total / release.size);
        if (percent !== lastPercent) {
          progress(percent);
          lastPercent = percent;
        }
        done(null, chunk);
      }
    }), fs.createWriteStream(file,{flags:'wx'}));
    if (total !== release.size || digest.digest('hex') !== release.digest) {
      throw new Error('Não foi possível confirmar a integridade do instalador.');
    }
    return file;
  } catch (error) {
    await fs.promises.unlink(file).catch(()=>{});
    await fs.promises.rmdir(folder).catch(()=>{});
    throw error;
  }
}

async function verifyInstaller(file, expected) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error('O instalador baixado não passou na verificação.');
}

module.exports = {readRelease, findRelease, downloadInstaller, verifyInstaller};

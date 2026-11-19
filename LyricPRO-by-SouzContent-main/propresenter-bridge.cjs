'use strict';

const {performance} = require('node:perf_hooks');
const {setTimeout: delay} = require('node:timers/promises');

function slideEndpoint(address) {
  const input = String(address).trim();
  const url = new URL(input.includes('://') ? input : 'http://' + input);
  if (url.protocol !== 'http:' || !url.port || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Informe o IP e a porta HTTP do Mac, por exemplo 192.168.1.20:1025.');
  }
  return new URL('/v1/status/slide', url);
}

function slideText(slide) {
  if (slide == null) return '';
  if (typeof slide.text !== 'string') throw new Error('Formato de slide inesperado');
  return slide.text.replace(/\r\n?/g, '\n');
}

async function readSlides(url, signal) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal
  });
  if (response.status === 204) return {current: '', next: ''};
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('API HTTP ' + response.status);
  }
  const slides = await response.json();
  if (slides === null) return {current: '', next: ''};
  if (typeof slides !== 'object' || Array.isArray(slides)) {
    throw new Error('Resposta de slides inesperada');
  }
  return {current: slideText(slides.current), next: slideText(slides.next)};
}

async function followSlides(url, signal, publish, {interval = 50, retry = 750, timeout = 1000} = {}) {
  let previous;
  while (!signal.aborted) {
    const started = performance.now();
    let update, wait;
    try {
      const slides = await readSlides(url, AbortSignal.any([signal, AbortSignal.timeout(timeout)]));
      update = {status: 'connected', ...slides};
      wait = Math.max(0, interval - (performance.now() - started));
    } catch (error) {
      update = {
        status: 'retrying', current: '', next: '',
        detail: error.name === 'TimeoutError' ? 'Tempo limite da API' : error.message
      };
      wait = retry;
    }
    if (signal.aborted) break;
    if (!previous || Object.keys(update).some(key => update[key] !== previous[key])) {
      previous = update;
      publish(update);
    }
    await delay(wait, undefined, {signal}).catch(error => {
      if (!signal.aborted) throw error;
    });
  }
}

module.exports = {slideEndpoint, readSlides, followSlides};

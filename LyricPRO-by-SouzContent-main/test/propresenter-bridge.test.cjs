'use strict';

const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {setTimeout: wait} = require('node:timers/promises');
const {test} = require('node:test');
const {slideEndpoint, readSlides, followSlides} = require('../propresenter-bridge.cjs');
require('../app/propresenter-stage.js');

test('uses the configured HTTP host and a fixed read-only route', () => {
  assert.equal(slideEndpoint('192.168.1.20:1025').href, 'http://192.168.1.20:1025/v1/status/slide');
  for (const address of ['mac.local', 'mac.local:1025/trigger', 'https://mac.local:1025',
    'http://user:secret@mac.local:1025', 'mac.local:1025/?q=1']) {
    assert.throws(() => slideEndpoint(address));
  }
});

test('reads live and next over HTTP, blanks on failure and reconnects', {timeout: 5000}, async t => {
  let calls = 0;
  let active = 0;
  let peak = 0;
  const requests = [];
  const server = createServer(async (req, res) => {
    requests.push([req.method, req.url]);
    const call = ++calls;
    peak = Math.max(peak, ++active);
    await wait(20);
    active--;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (call === 3) {
      res.writeHead(503).end('{}');
      return;
    }
    const first = {current: {text: 'Canção\r\nAo vivo'}, next: {text: '<b>Refrão</b>'}};
    const second = {current: {text: '<b>Refrão</b>'}, next: null};
    res.end(JSON.stringify(call < 3 ? first : second));
  });
  t.after(() => { server.close(); server.closeAllConnections(); });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = slideEndpoint('127.0.0.1:' + server.address().port);
  const stop = new AbortController();
  const states = [];
  await followSlides(url, stop.signal, state => {
    states.push(state);
    if (states.length === 3) stop.abort();
  }, {interval: 5, retry: 5, timeout: 500});

  assert.deepEqual(states, [
    {status: 'connected', current: 'Canção\nAo vivo', next: '<b>Refrão</b>'},
    {status: 'retrying', current: '', next: '', detail: 'API HTTP 503'},
    {status: 'connected', current: '<b>Refrão</b>', next: ''}
  ]);
  assert.equal(requests.length, 4);
  assert.ok(requests.every(([method, route]) => method === 'GET' && route === '/v1/status/slide'));
  assert.equal(peak, 1);
});

test('accepts an empty response and rejects redirects and invalid text', async t => {
  const replies = [
    [204, {}, undefined],
    [302, {Location: '/unsafe'}, undefined],
    [200, {}, '{"current":{"text":42}}']
  ];
  const server = createServer((_req, res) => {
    const [code, headers, body] = replies.shift();
    res.writeHead(code, headers).end(body);
  });
  t.after(() => { server.close(); server.closeAllConnections(); });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = slideEndpoint('127.0.0.1:' + server.address().port);
  assert.deepEqual(await readSlides(url), {current: '', next: ''});
  await assert.rejects(readSlides(url));
  await assert.rejects(readSlides(url), /Formato de slide/);
});

test('promotes the prepared layer only when confirmed live, including jumps and clear', () => {
  function layer() {
    const classes = new Set();
    return {textContent: '', classes, classList: {
      remove: name => classes.delete(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
    }};
  }
  const layers = [layer(), layer()];
  const render = globalThis.createProPresenterStage(layers);
  const state = () => layers.map(item => [item.textContent, item.classes.has('bridge-live')]);

  render({current: 'A', next: 'B'});
  assert.deepEqual(state(), [['A', true], ['B', false]]);
  render({current: 'A', next: 'C'});
  assert.deepEqual(state(), [['A', true], ['C', false]]);
  render({current: 'C', next: 'D'});
  assert.deepEqual(state(), [['D', false], ['C', true]]);
  render({current: '<b>Pulo</b>', next: 'E'});
  assert.deepEqual(state(), [['E', false], ['<b>Pulo</b>', true]]);
  render({current: '', next: ''});
  assert.deepEqual(state(), [['', false], ['', false]]);
  render(null);
  assert.deepEqual(state(), [['', false], ['', false]]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeBrowserTarget, extractBrowserShare, planBrowserCall, BROWSER_MCP_TOOLS } from '../public/app/shared/browser-connection-core-v1.mjs';

const read = path => fs.readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('browser receiver accepts only safe http(s) URLs and strips fragments', () => {
  assert.equal(normalizeBrowserTarget('https://example.org/hello#token'), 'https://example.org/hello');
  for (const url of ['file:///etc/passwd','javascript:alert(1)','https://user:pass@example.org','http://localhost/a','http://127.0.0.1','http://192.168.1.8','http://[::1]/','https://site.local/']) {
    assert.equal(normalizeBrowserTarget(url), null, url);
  }
});
test('receiving a shared page carries bounded user-visible text, not arbitrary HTML', () => {
  const share=extractBrowserShare({title:'An article', text:'See https://example.org/long#section',url:''});
  assert.equal(share.url,'https://example.org/long');
  assert.equal(share.title,'An article');
  assert.ok(share.text.length <= 600);
  assert.equal(extractBrowserShare({url:'data:text/html,hi'}).url, '');
});
test('model tools require deliberate network approval and a target URL', () => {
  assert.equal(planBrowserCall('browser.archive_search',{query:'history'},{networkAllowed:false}).ok,true);
  assert.equal(planBrowserCall('browser.search',{query:'current news'},{networkAllowed:false}).reason,'network-permission-required');
  assert.equal(planBrowserCall('browser.open',{url:'https://example.org'},{networkAllowed:true}).ok,true);
  assert.equal(planBrowserCall('browser.open',{url:'http://169.254.1.2'},{networkAllowed:true}).ok,false);
  assert.equal(planBrowserCall('browser.open',{url:'https://example.org'},{networkAllowed:false}).ok,false);
  assert.equal(planBrowserCall('browser.execute_script',{script:'alert(1)'},{networkAllowed:true}).reason,'unknown-tool');
  assert.ok(BROWSER_MCP_TOOLS.some(item=>item.name==='browser.accessibility'));
});
test('one shared browser panel connects to canonical guide chat without creating another chat system', () => {
  const panel=read('public/app/browser-connection-v1.js');
  const chat=read('public/app/guide-chat-surface-v350.js');
  const shell=read('public/app/persistent-system-shell-v1.html');
  assert.match(panel,/CivweaveBrowserConnectionV1/);
  assert.match(panel,/CivweaveGuideChatSurfaceV350/);
  assert.match(panel,/data-search-web/,'Live web search control must be present');
  assert.match(panel,/renderEvidence\(output\)/,'Search results must render in-app');
  assert.match(chat,/data-browser/);
  assert.match(shell,/browser-connection-v1\.js/);
  assert.doesNotMatch(panel,/CivweaveAssistantV141\.respond|new WebSocket\(/);
});
test('installed PWA receives shared pages through a same-origin Web Share Target', () => {
  const manifest=JSON.parse(read('public/app/manifest.webmanifest'));
  assert.equal(manifest.share_target?.action, '/app/browser-receiver-v1.html');
  assert.equal(manifest.share_target?.method, 'GET');
  const receiver=read('public/app/browser-receiver-v1.html');
  assert.match(receiver,/civweave\.browser\.receive\.v1/);
  assert.match(receiver,/persistent-system-shell-v1\.html/);
  const assets=JSON.parse(read('public/app/offline-package-v208.json')).assets;
  for(const path of ['/app/browser-receiver-v1.html','/app/browser-connection-v1.js','/app/shared/browser-connection-core-v1.mjs']) assert.ok(assets.includes(path),path);
});

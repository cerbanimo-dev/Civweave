import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const root=new URL('../',import.meta.url);
test('shared navigation exposes one explicit Collective action without booting models',async()=>{
 const dom=new JSDOM('<body><nav id="cw-themed-system-nav"><div class="cw-nav-utilities"></div></nav></body>',{url:'https://example.test/app/persistent-system-shell-v1.html',runScripts:'outside-only'});
 const w=dom.window; let opened=0; const observers=[]; const Observer=w.MutationObserver;
 w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this)}};
 w.CivweaveStarlingIntegrationV1={open:async()=>{opened++;}};
 w.eval(await readFile(new URL('public/app/persistent-shell-actions-v1.js',root),'utf8'));
 w.CivweavePersistentShellActionsV1.ensureMounted();
 const action=w.document.querySelector('[data-cw-persistent-action="starling"]'); assert.ok(action);
 assert.equal(opened,0); action.click(); await new Promise(r=>setTimeout(r,0)); assert.equal(opened,1);
 assert.equal(w.document.querySelectorAll('[data-cw-persistent-action="starling"]').length,1);
 for(const observer of observers)observer.disconnect(); dom.window.close();
});

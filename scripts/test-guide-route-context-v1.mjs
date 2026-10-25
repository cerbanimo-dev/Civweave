import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=name=>fs.readFileSync(new URL(`../public/app/${name}`,import.meta.url),'utf8');
const systems=[['civweave','Weaveling'],['living-school','Moss'],['cerbanimo','Kamiya'],['fellowfare','Rook'],['anarchadia','Merlin']];
function fixture(t){
  const dom=new JSDOM('<!doctype html><html><head></head><body><iframe id="cw-persistent-system-stage"></iframe><div id="cw-persistent-system-loading"></div><div id="cw-persistent-system-error"></div></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=anarchadia',runScripts:'outside-only'});
  const {window}=dom;t.after(()=>window.close());
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.MutationObserver=undefined;
  window.setTimeout=()=>0;window.clearTimeout=()=>{};window.setInterval=()=>0;window.clearInterval=()=>{};window.requestAnimationFrame=()=>0;
  window.CivweaveLocalSpecializedAI={};
  window.eval(read('persistent-system-shell-v1.js'));
  window.eval(read('guide-chat-surface-v350.js'));
  window.eval(read('persistent-system-context-v1.js'));
  return window;
}

test('same-document shell navigation refreshes the page guide launcher for all five systems',t=>{
  const window=fixture(t),guide=window.CivweaveGuideChatSurfaceV350,shell=window.CivweavePersistentSystemShellV1;
  for(const [system,name] of systems){
    assert.equal(shell.navigate(system),true);
    const launcher=window.document.getElementById('cwp215-launcher');
    assert.equal(guide.state().pageSystem,system,'The parent launcher must follow the currently displayed system without a reload.');
    assert.equal(launcher.getAttribute('aria-label'),`Talk to ${name}`);
    assert.equal(launcher.querySelector('img').alt,name);
    assert.equal(window.CivweavePersistentSystemContextV1.selected(),system);
    launcher.click();
    assert.equal(guide.state().activeSystem,system,'The refreshed launcher must open the visible system’s guide.');
    guide.close();
  }
});

test('route context refresh preserves an explicitly open guide and its conversation elements',t=>{
  const window=fixture(t),guide=window.CivweaveGuideChatSurfaceV350;
  window.localStorage.setItem('civweave.guide-thread.v350.fellowfare',JSON.stringify({system:'fellowfare',messages:[{id:'qa-rook-message',role:'assistant',text:'Your fictional notebook Manifest is saved.'}]}));
  guide.open({guide:'fellowfare',focus:false});
  const article=window.document.querySelector('[data-message-id="qa-rook-message"]'),bubble=article.querySelector('.cw350-bubble');
  window.CivweavePersistentSystemShellV1.navigate('cerbanimo');
  assert.equal(guide.state().pageSystem,'cerbanimo');
  assert.equal(guide.state().activeSystem,'fellowfare','Changing the page must preserve the explicitly selected open conversation.');
  assert.equal(guide.state().open,true);
  assert.equal(window.document.querySelector('[data-message-id="qa-rook-message"]'),article);
  assert.equal(article.querySelector('.cw350-bubble'),bubble);
  assert.equal(bubble.textContent,'Your fictional notebook Manifest is saved.');
  assert.match(window.document.querySelector('[data-context]').textContent,/FellowFare conversation · opened from Cerbanimo/);
  assert.equal(window.document.getElementById('cwp215-launcher').getAttribute('aria-label'),'Talk to Kamiya');
});

test('unrelated route events do not assign an unknown page guide',t=>{
  const window=fixture(t),guide=window.CivweaveGuideChatSurfaceV350;
  window.dispatchEvent(new window.CustomEvent('civweave:system-route-changed',{detail:{system:'unknown'}}));
  assert.equal(guide.state().pageSystem,'anarchadia');
  assert.equal(window.document.getElementById('cwp215-launcher').getAttribute('aria-label'),'Talk to Merlin');
});

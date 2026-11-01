import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createWorkspace} from '../public/app/shared/worldweaver-workspace-v1.mjs';
import {mountWorkspace} from '../public/app/worldweaver/workspace.mjs';

const html=()=>readFileSync(new URL('../public/app/worldweaver/index.html',import.meta.url),'utf8');
function setup(){
  let value=null,fail=false,seq=0;
  const storage={getItem:()=>value,setItem:(_key,next)=>{if(fail)throw new Error('Storage full');value=next}};
  const workspace=createWorkspace({storage,id:()=>`record-${++seq}`,clock:()=> '2026-10-30T12:00:00Z'});
  const dom=new JSDOM(html(),{url:'https://civweave.test/app/worldweaver/index.html'});
  const downloads=[];
  const api=mountWorkspace({document:dom.window.document,window:dom.window,workspace,download:packet=>downloads.push(packet)});
  const $=selector=>dom.window.document.querySelector(selector);
  const submit=id=>$(id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  const create=(title='Bridge workshop')=>{$('#space-title').value=title;submit('#ww-create-form')};
  return {dom,$,submit,create,api,workspace,downloads,fail:()=>{fail=true}};
}

test('opening is read-only; four templates create a real local draft and stations survive reopening',()=>{
  const k=setup();
  assert.equal(k.workspace.snapshot().instances.length,0);
  assert.equal(k.dom.window.document.querySelectorAll('[data-template]').length,4);
  k.create();
  assert.equal(k.workspace.snapshot().instances[0].title,'Bridge workshop');
  assert.equal(k.dom.window.document.activeElement,k.$('#ww-space-title'));
  assert.match(k.$('#ww-space-status').textContent,/draft/i);
  k.$('#station-title').value='Try the joint';
  k.$('#station-instructions').value='Fit the two pieces together.';
  k.submit('#ww-station-form');
  k.$('[data-station]').click();
  assert.match(k.$('#ww-station-detail').textContent,/Fit the two pieces together/);
  k.api.destroy();
  const again=mountWorkspace({document:k.dom.window.document,window:k.dom.window,workspace:k.workspace});
  assert.match(k.$('#ww-stage').textContent,/Try the joint/);
  again.destroy();
});

test('connections keep references and use existing capability routes without performing their actions',()=>{
  const k=setup();k.create();
  k.$('[data-tab="connections"]').click();
  k.$('#reference-id').value='learning-path-12';k.submit('#ww-link-form');
  assert.equal(k.workspace.snapshot().links[0].authoritative,false);
  assert.match(k.$('#ww-links').textContent,/learning-path-12/);
  assert.match(k.$('#ww-open-tool').getAttribute('href'),/living-school/);
  assert.match(k.$('#ww-open-guide').getAttribute('href'),/feature=chat/);
  assert.equal(k.workspace.snapshot().instances[0].status,'draft');
  k.api.destroy();
});

test('character setup never runs a model or claims a live NPC, and exports only the selected space',()=>{
  const k=setup();k.create('First space');
  k.$('[data-tab="characters"]').click();
  k.$('#npc-name').value='Ada';k.$('#npc-model').value='qwen3.5:4b';
  k.$('#npc-prompt').value='Explain the exercise one step at a time.';
  k.submit('#ww-npc-form');
  assert.equal(k.workspace.snapshot().npcs.length,1);
  assert.equal(k.workspace.snapshot().intents.length,0);
  assert.match(k.$('#ww-npcs').textContent,/not running/i);
  k.$('#ww-new-space').click();k.create('Second space');
  k.$('#ww-export').click();
  assert.equal(k.downloads.length,1);
  assert.equal(k.downloads[0].instances.length,1);
  assert.equal(k.downloads[0].instances[0].title,'Second space');
  assert.equal(k.downloads[0].npcs.length,0);
  k.api.destroy();
});

test('failed persistence is visible and preserves the user input; text is never interpreted as markup',()=>{
  const k=setup();k.create('<img src=x onerror=alert(1)>');
  assert.equal(k.$('#ww-space-title img'),null);
  k.$('#station-title').value='Unsaved station';k.$('#station-instructions').value='Keep these instructions.';
  k.fail();k.submit('#ww-station-form');
  assert.equal(k.workspace.snapshot().stations.length,0);
  assert.equal(k.$('#station-title').value,'Unsaved station');
  assert.match(k.$('#ww-message').textContent,/storage|save/i);
  k.api.destroy();
});

test('tabs support keyboard selection and listener teardown does not duplicate mutations',()=>{
  const k=setup();k.create();
  k.$('[data-tab="plan"]').dispatchEvent(new k.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  assert.equal(k.$('[data-tab="connections"]').getAttribute('aria-selected'),'true');
  assert.equal(k.$('#ww-tab-connections').hidden,false);
  k.api.destroy();
  const before=k.workspace.snapshot().revision;k.submit('#ww-station-form');
  assert.equal(k.workspace.snapshot().revision,before);
});

test('corrupt saved data remains explained until explicit recovery succeeds',()=>{
  const dom=new JSDOM(html(),{url:'https://civweave.test/app/worldweaver/index.html'});
  // A corrupt persisted envelope must keep an actionable explanation on screen.
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{corrupt'}});
  try{
    const api=mountWorkspace({document:dom.window.document,window:dom.window});
    const $=selector=>dom.window.document.querySelector(selector);
    const error=$('#ww-message').textContent;
    assert.match(error,/Invalid|corrupt/i);
    $('#ww-new-space').click();
    assert.equal($('#ww-message').hidden,false);
    assert.equal($('#ww-message').textContent,error);
    assert.equal($('#space-title').disabled,true);
    api.destroy();
  }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;dom.window.close()}
});

test('workspace declares one core owner, one storage adapter and the existing navigation owner',()=>{
  const registry=JSON.parse(readFileSync(new URL('../config/system-ownership.json',import.meta.url),'utf8')).systems.worldweaver;
  assert.equal(registry.owner,'public/app/shared/worldweaver-core-v1.mjs');
  assert.equal(registry.workspaceAdapter,'public/app/shared/worldweaver-workspace-v1.mjs');
  assert.equal(registry.presentationCaller,'public/app/worldweaver/workspace.mjs');
  assert.ok(registry.allowedCallers.includes(registry.workspaceAdapter));
  assert.match(html(),/themed-system-nav-v178\.js/);
  assert.match(html(),/persistent-shell-actions-v1\.js/);
});

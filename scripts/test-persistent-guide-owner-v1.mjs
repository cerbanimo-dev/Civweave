import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/guide-chat-surface-v350.js',import.meta.url),'utf8');
for(const late of [false,true])test(`persistent content uses the same parent chat API${late?' after parent readiness':''}`,()=>{
  const dom=new JSDOM('<main>FellowFare</main>',{url:'https://civweave.test/app/fellowfare-cabinet-v144.html?embed=1&persistentShell=1#market',runScripts:'outside-only'});
  const listeners=new Map(),calls=[],api={canonicalOwner:true,open:options=>{calls.push(options);return true}},parent={CivweavePersistentSystemShellV1:{persistentNavbar:true},addEventListener:(type,fn)=>listeners.set(type,fn)};
  if(!late)parent.CivweaveGuideChatSurfaceV350=api;
  Object.defineProperty(dom.window,'parent',{value:parent,configurable:true});
  try{
    dom.window.eval(source);
    if(late){assert.equal(dom.window.CivweaveGuideChatSurfaceV350,undefined);parent.CivweaveGuideChatSurfaceV350=api;listeners.get('civweave:guide-chat-ready')?.();}
    assert.equal(dom.window.CivweaveGuideChatSurfaceV350,api,'A content frame must not construct a second chat owner.');
    assert.equal(dom.window.CivweavePersistentGuideChatV215,api);
    dom.window.CivweaveGuideChatSurfaceV350.open({guide:'fellowfare'});
    assert.equal(calls.length,1);assert.equal(calls[0].guide,'fellowfare');
    assert.equal(dom.window.document.querySelector('#cwp215-launcher,#cw-persistent-guide-chat-v215'),null);
    assert.equal(dom.window.document.querySelector('#cw-guide-chat-surface-v350-style'),null);
  }finally{dom.window.close()}
});

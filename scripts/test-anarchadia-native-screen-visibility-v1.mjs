import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=file=>fs.readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8');
const html=read('anarchadia-console-v139.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const source=read('anarchadia-console-v158.js');
// Preserve the real load order: the expanded Passport styles follow console styles.
const styles=['anarchadia-console-v139.css','anarchadia-passport-v193.css'].map(read);

function fixture(){
  const dom=new JSDOM(html,{url:'https://civweave.test/app/anarchadia-console-v139.html?cabinet=1&embed=1&persistentShell=1',runScripts:'outside-only'});
  const {window}=dom;
  window.scrollTo=()=>{};
  window.requestAnimationFrame=()=>0;
  for(const text of styles){const style=window.document.createElement('style');style.textContent=text;window.document.head.append(style)}
  window.eval(source);
  return{window,close:()=>window.close(),select:screen=>window.document.querySelector(`[data-screen-target="${screen}"]`).click()};
}
function assertHome(window,visible){
  for(const selector of ['.ac-passport','.ac-grid','.ac-pulse']){
    const node=window.document.querySelector(selector);
    assert.equal(node.hidden,!visible,`${selector} belongs only to the home screen`);
    assert.equal(window.getComputedStyle(node).display==='none',!visible,`${selector} must obey the controller's hidden state`);
  }
}
for(const screen of ['proposals','ledger','automation','observatory']){
  test(`native ${screen} replaces the Passport and home options, then restores them on return`,()=>{
    const app=fixture();
    try{
      assertHome(app.window,true);
      app.select(screen);
      assert.equal(app.window.document.querySelector('#ac-app').dataset.screen,screen);
      assertHome(app.window,false);
      for(const node of app.window.document.querySelectorAll('.ac-screen'))assert.equal(app.window.getComputedStyle(node).display==='none',node.dataset.screen!==screen);
      app.select('home');
      assertHome(app.window,true);
      assert.equal(app.window.getComputedStyle(app.window.document.querySelector('.ac-passport')).display,'block','Expanded Passport presentation must survive returning home');
      assert.equal(app.window.getComputedStyle(app.window.document.querySelector('.ac-grid')).display,'grid','Home options must retain their grid');
    }finally{app.close()}
  });
}
test('the native feature request form stays visible without retaining home content above it',()=>{
  const app=fixture();
  try{
    app.select('proposals');
    app.window.document.querySelector('[data-request-kind="feature"]').click();
    assertHome(app.window,false);
    assert.equal(app.window.document.querySelector('#ac-app').dataset.screen,'request');
    assert.notEqual(app.window.getComputedStyle(app.window.document.querySelector('#screen-request')).display,'none');
    app.window.document.querySelector('#screen-request [data-screen-target="proposals"]').click();
    assert.equal(app.window.document.querySelector('#screen-request').hidden,true);
    assertHome(app.window,false);
  }finally{app.close()}
});

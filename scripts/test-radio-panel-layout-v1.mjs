import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source=await readFile(new URL('../public/app/system-radio-agent-v233.js',import.meta.url),'utf8');
function matches(query,width,height){
  return query.split(',').some(part=>{
    let okay=true;
    const rest=part.replace(/\(\s*(min|max)-(width|height)\s*:\s*(\d+)px\s*\)/gi,(_,bound,axis,value)=>{const size=axis==='width'?width:height;okay&&=bound==='min'?size>=Number(value):size<=Number(value);return''}).replace(/\band\b|\bonly\b|\bscreen\b|\ball\b/gi,'').trim();
    return okay&&!rest;
  });
}
function fixture(width,height){
  const dom=new JSDOM('<!doctype html><html data-civweave-system="civweave" data-persistent-system="civweave"><head></head><body></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=civweave',runScripts:'outside-only'}),w=dom.window;
  Object.defineProperty(w.document,'readyState',{value:'complete'});w.eval(source);
  // jsdom does not lay out pixels or apply viewport media queries. Select the
  // owner's actual CSSOM rules for these dimensions, then inspect its real
  // cascade. No rectangles or synthetic element geometry are supplied.
  const original=w.document.getElementById('cw-radio-station-surface-v1-style');
  const select=rules=>[...rules].flatMap(rule=>rule.type===4?(matches(rule.conditionText,width,height)?select(rule.cssRules):[]):rule.type===1?[rule.cssText]:[]);
  const selected=select(original.sheet.cssRules).join('\n');original.remove();
  const style=w.document.createElement('style');style.textContent=selected;w.document.head.append(style);
  const panel=w.document.getElementById('cw-radio-station-panel-v1');panel.hidden=false;
  const css=selector=>w.getComputedStyle(panel.querySelector(selector));
  return{dom,w,panel,css,close:()=>w.close()};
}

for(const [width,height]of [[390,667],[390,600],[1166,884]])test(`radio keeps header/player outside the track scroller at ${width}×${height}`,()=>{
  const x=fixture(width,height);
  try{
    const panel=x.w.getComputedStyle(x.panel),body=x.css('[data-radio-body]');
    assert.equal(panel.display,'grid');assert.match(panel.gridTemplateRows,/^auto auto auto minmax\(0(?:px)?,\s*1fr\)$/);
    assert.equal(panel.overflow,'hidden','Outer panel must not scroll Close and player controls offscreen');
    assert.equal(body.overflow,'auto');assert.equal(body.minHeight,'0','The tracklist must shrink inside the fixed panel');
    assert.equal(x.css('.cw-radio-player').display,'grid');assert.equal(x.css('[data-radio-play]').minHeight,'44px');
    assert.equal(x.css('[data-radio-close]').height,'44px');
    assert.equal(x.css('[data-radio-current-credits]').overflow,'auto','Long attribution stays readable without pushing controls out of the panel');
  }finally{x.close()}
});

test('expanded Spotify controls scroll inside their own bounded row instead of displacing the player',()=>{
  const x=fixture(390,667);
  try{
    x.panel.querySelector('details').open=true;
    const mode=x.css('.cw-radio-modebar');assert.equal(mode.maxHeight,'112px');assert.equal(mode.overflowY,'auto');
    assert.equal(x.w.getComputedStyle(x.panel).overflow,'hidden');assert.equal(x.css('[data-radio-body]').overflow,'auto');
  }finally{x.close()}
});

test('very short screens keep Close sticky while allowing every control to be reached by scrolling',()=>{
  const x=fixture(390,420);
  try{
    assert.equal(x.w.getComputedStyle(x.panel).display,'block');assert.equal(x.w.getComputedStyle(x.panel).overflow,'auto');
    const header=x.css(':scope > header');assert.equal(header.position,'sticky');assert.equal(header.top,'0px');
    assert.equal(x.css('[data-radio-body]').overflow,'visible');assert.equal(x.css('.cw-radio-modebar').maxHeight,'none');
  }finally{x.close()}
});

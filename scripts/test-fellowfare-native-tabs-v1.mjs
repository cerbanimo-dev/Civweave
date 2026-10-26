import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=file=>fs.readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8');
const html=read('fellowfare-cabinet-v144.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const css=['go-live-visual-v300.css','fellowfare-cabinet-v144.css','fellowfare-parent-theme-v205.css','fellowfare-native-v208.css'].map(read);

function widthQueryMatches(query,width){
  return query.split(',').some(alternative=>{
    let valid=true;
    const remainder=alternative.replace(/\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/gi,(_,kind,bound)=>{valid&&=kind.toLowerCase()==='min'?width>=Number(bound):width<=Number(bound);return''}).replace(/\band\b|\bonly\b|\bscreen\b|\ball\b/gi,'').trim();
    return valid&&!remainder;
  });
}
function fixture(width){
  const dom=new JSDOM(html,{url:'https://civweave.test/app/fellowfare-cabinet-v144.html?embed=1&persistentShell=1',runScripts:'outside-only'}),{window}=dom;
  window.document.body.classList.add('ff-market-native');
  // jsdom has no media layout engine. Select real CSSOM rules for this viewport
  // before asking its actual cascade for styles; no element geometry is mocked.
  const rulesForWidth=rules=>[...rules].flatMap(rule=>rule.type===4?(widthQueryMatches(rule.conditionText,width)?rulesForWidth(rule.cssRules):[]):rule.type===1?[rule.cssText]:[]);
  for(const text of css){
    const parser=window.document.createElement('style');parser.textContent=text;window.document.head.append(parser);
    const selected=rulesForWidth(parser.sheet.cssRules).join('\n');parser.remove();
    const style=window.document.createElement('style');style.textContent=selected;window.document.head.append(style);
  }
  return{window,close:()=>window.close(),bar:window.document.querySelector('.ffc144-tabs')};
}
for(const width of [320,390,760])test(`all five native FellowFare tabs share the ${width}px phone bar without a horizontal scroller`,()=>{
  const app=fixture(width);
  try{
    const {window,bar}=app,style=window.getComputedStyle(bar),buttons=[...bar.querySelectorAll('button')];
    assert.deepEqual(buttons.map(button=>button.textContent.trim()),['Market','Sell','Orders','Wallet','You']);
    assert.equal(style.display,'grid','Shared mobile presentation must not turn the native tabs into an 84px-per-tab flex scroller');
    assert.match(style.gridTemplateColumns,/^repeat\(5,\s*minmax\(0(?:px)?,\s*1fr\)\)$/);
    assert.equal(style.overflowX,'visible','The native bar should expose its five buttons directly');
    for(const button of buttons){const value=window.getComputedStyle(button);assert.ok(parseFloat(value.minHeight)>=44,'Every native tab must retain a 44px touch target');assert.equal(value.minWidth,'0')}
  }finally{app.close()}
});
test('desktop FellowFare retains its existing tab layout and dimensions',()=>{
  const app=fixture(1024);
  try{const {window,bar}=app;assert.equal(window.getComputedStyle(bar).display,'grid');assert.equal(window.getComputedStyle(bar.querySelector('button')).minHeight,'34px')}
  finally{app.close()}
});

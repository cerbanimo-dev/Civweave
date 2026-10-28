import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/shared-review-surface-v234.js',import.meta.url),'utf8'),key='civweave.intentions.v127';
function item(){return{id:'quest-compact',kind:'weave-plan',state:'review',plan:{id:'quest-compact',title:'Fictional stool repair',state:'review',paths:[
  {id:'learn',realm:'living-school',title:'Learn the joint',steps:[{id:'inspect',title:'Inspect the joint',status:'accepted'},{id:'measure',title:'Measure the joint',status:'draft'}]},
  {id:'build',realm:'cerbanimo',title:'Build the joint',steps:[{id:'assemble',title:'Assemble the joint',status:'review',dependsOn:['inspect']}]},
  {id:'supply',realm:'fellowfare',title:'Gather materials',steps:['Borrow a clamp']},
  {id:'consent',realm:'anarchadia',title:'Agree on use',steps:['Ask the workshop owner']}
],governance:{title:'Workshop consent layer',agreements:['Respect the shared tools'],reviewQuestion:'Who needs to consent?'}}}}
async function browser(t,record=item()){
  const dom=new JSDOM('<!doctype html><html><head></head><body><div id="weaveling-hub-v233"><div class="wh233-thread"></div></div><button data-gate="open-plan" data-id="quest-compact">Review</button></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const win=dom.window;win.structuredClone=structuredClone;win.localStorage.setItem(key,JSON.stringify([record]));const before=win.localStorage.getItem(key);let writes=0,fetches=0;
  const save=win.Storage.prototype.setItem;win.Storage.prototype.setItem=function(...args){writes++;return save.apply(this,args)};win.fetch=async()=>{fetches++;throw new Error('Unexpected network work')};
  win.eval(source);if(win.document.readyState==='loading')win.dispatchEvent(new win.Event('DOMContentLoaded'));win.document.querySelector('[data-gate]').click();await new Promise(resolve=>setImmediate(resolve));
  return{win,document:win.document,map:win.document.querySelector('[data-private-quest-map]'),before,get writes(){return writes},get fetches(){return fetches}};
}

test('the private map opens as four compact subsystem overviews with collapsed beat details and visible counts',async t=>{
  const h=await browser(t);assert.ok(h.map);
  for(const realm of ['living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(h.map.querySelector(`[data-map-lane="${realm}"]`));
  const details=[...h.map.querySelectorAll('[data-map-beats]')];assert.equal(details.length,4);assert.ok(details.every(node=>node.tagName==='DETAILS'&&!node.open),'opening a Quest must not expand its beat lists');
  const learning=h.map.querySelector('[data-map-lane="living-school"]');assert.match(learning.querySelector('[data-map-lane-counts]').textContent,/1 path.*2 beats/s);assert.match(learning.querySelector('[data-map-path-counts]').textContent,/1 accepted/);
  assert.ok(h.map.querySelector('[data-map-plan-order]'));assert.equal(h.map.querySelectorAll('[data-map-plan-order] button').length,4,'the separate governance layer is not another dependency or ordered work path');
  assert.match(h.map.querySelector('[data-map-plan-order]').textContent,/Plan order.*not dependencies/s);assert.match(h.map.querySelector('[data-map-governance="true"]').textContent,/Workshop consent layer/);
  assert.equal(h.fetches,0);assert.equal(h.writes,0);assert.equal(h.win.localStorage.getItem(key),h.before);
});

test('expanding beats preserves declared links while quick controls still focus the existing path details',async t=>{
  const h=await browser(t),detail=h.map.querySelector('[data-map-beats="1"]');assert.ok(detail);
  detail.querySelector('summary').click();assert.equal(detail.open,true);assert.match(detail.textContent,/Declared dependencies/);assert.ok(detail.querySelector('[data-map-edge-from="inspect"][data-map-edge-to="assemble"]'));
  h.map.querySelector('[data-map-plan-order] [data-path-index="1"]').click();assert.equal(h.document.activeElement,h.document.querySelector('[data-review-path="1"]'));
  assert.equal(h.writes,0);assert.equal(h.win.localStorage.getItem(key),h.before);
});

test('empty lanes and saved completed labels do not become verified work or fabricated dependencies',async t=>{
  const record=item();record.plan.paths=record.plan.paths.slice(0,1);record.plan.paths[0].steps[1].status='completed';delete record.plan.governance;
  const h=await browser(t,record),learning=h.map.querySelector('[data-map-lane="living-school"]');
  assert.match(learning.querySelector('[data-map-path-counts]').textContent,/1 accepted.*1 marked complete/s);assert.match(h.map.querySelector('[data-map-lane="fellowfare"]').textContent,/0 paths.*0 beats/s);
  assert.equal(h.map.querySelectorAll('[data-map-edge-from]').length,0);assert.doesNotMatch(h.map.textContent,/verified|proof accepted|100%/i);assert.equal(h.writes,0);
});

test('compact map CSS keeps two readable phone columns, independent details and a bounded horizontal order strip',async t=>{
  const h=await browser(t),style=h.document.getElementById('cw-shared-review-style-v234');assert.ok(style);
  const rules=[...style.sheet.cssRules],mobile=rules.filter(rule=>rule.media?.mediaText==='(max-width:560px)');
  const laneRules=mobile.flatMap(rule=>[...rule.cssRules]).filter(rule=>rule.selectorText?.endsWith('.cwsr234-map-lanes'));
  assert.ok(laneRules.length);assert.equal(laneRules.at(-1).style.getPropertyValue('grid-template-columns'),'repeat(2,minmax(0,1fr))');
  const order=rules.find(rule=>rule.selectorText?.endsWith('.cwsr234-map-order-strip'));assert.ok(order);assert.equal(order.style.getPropertyValue('overflow-x'),'auto');
  const summary=rules.find(rule=>rule.selectorText?.endsWith('.cwsr234-map-beats>summary'));assert.ok(summary);assert.equal(summary.style.getPropertyValue('min-height'),'44px');
  assert.equal(h.map.querySelector('[data-map-beats][open]'),null);
});

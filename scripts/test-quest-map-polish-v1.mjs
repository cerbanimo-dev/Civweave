import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const asset=path=>new URL('../public/'+path,import.meta.url);
const source=readFileSync(asset('app/shared/quest-pathway-map-v1.js'),'utf8');
const css=readFileSync(asset('app/shared/quest-pathway-map-v1.css'),'utf8');
const lanes=[
  ['living-school','Living School','moss'],
  ['cerbanimo','Cerbanimo','kamiya'],
  ['fellowfare','FellowFare','rook'],
  ['anarchadia','Anarchadia','merlin']
];
const plan=()=>({id:'saved-polish-quest',title:'Share a repaired reading bench',state:'active',paths:[
  {id:'learn-path',realm:'living-school',title:'Learn the repair',status:'completed',steps:[{id:'learn-inspect',title:'Inspect the joint',status:'accepted'},{id:'learn-practice',title:'Practice the fit',status:'completed'},{id:'learn-explain',title:'Explain the method',status:'ready'}],progress:[2,99,-1]},
  {id:'build-path',realm:'cerbanimo',title:'Repair the bench',dependsOn:['learn-inspect'],steps:['Check the tools',{id:'build-proof',title:'Save the inspection',status:'blocked'}],progress:[0,99,-1,1.5]},
  {id:'share-path',realm:'fellowfare',title:'Share the materials',dependsOn:['build-path'],steps:[{id:'share-list',title:'List spare timber',status:'active'}]},
  {id:'agree-path',realm:'anarchadia',title:'Agree the placement',dependsOn:['share-path'],steps:[{id:'agree-check',title:'Ask the affected group',status:'draft'}]}
]});

function browser(t,quest=plan(),options={}){
  const dom=new JSDOM('<!doctype html><html><body><main></main></body></html>',{url:'https://civweave.test/',runScripts:'outside-only',pretendToBeVisual:true}),win=dom.window;
  t.after(()=>win.close());win.eval(source);
  const api=win.CivweaveQuestPathwayMapV1,host=win.document.querySelector('main');host.innerHTML=api.render(quest,options);
  return{win,api,host,map:host.querySelector('[data-quest-pathway-map]')};
}
function clock(win){
  let now=0,next=0;const timers=new Map();
  win.setTimeout=(callback,delay=0,...args)=>{const id=++next;timers.set(id,{at:now+Number(delay),delay:Number(delay),run:()=>callback(...args)});return id};
  win.clearTimeout=id=>timers.delete(id);
  return{timers,advance(ms){const until=now+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].run()}now=until}};
}
function pointer(win,target,type,{x=20,y=20,id=1,button=0}={}){
  const event=new win.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button});
  Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'},isPrimary:{value:true}});target.dispatchEvent(event);return event;
}
const node=b=>b.host.querySelector('[data-quest-map-graph-node="p0-s0"]');
const detail={action:'inspect',questId:'saved-polish-quest',pathId:'learn-path',pathIndex:0,stepId:'learn-inspect',stepIndex:0,realm:'living-school',governance:false};
const plain=value=>JSON.parse(JSON.stringify(value));
const physicalClick=(win,target)=>target.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));

test('all four mobile lane headers use existing local faces and readable subsystem labels',t=>{
  const b=browser(t),headers=[...b.host.querySelectorAll('.cw-qmap-lane-labels > *')];assert.equal(headers.length,4);
  for(const[index,[realm,label,guide]]of lanes.entries()){
    const header=headers[index],image=header.querySelector('img');assert.ok(image,`${label} needs its image header`);
    const src=`/app/assets/ai/chat/${guide}-face-v255.webp`;assert.equal(image.getAttribute('src'),src);assert.ok(existsSync(asset(src.slice(1))),`${src} must be packaged locally`);
    assert.ok(header.textContent.includes(label)||header.getAttribute('aria-label')===label||image.alt===label,`${label} needs a semantic text alternative`);
    assert.ok(b.host.querySelector(`[data-quest-map-lane="${realm}"]`));
  }
});

test('the four-lane canvas fits its container and reserves internal scrolling for the vertical axis',t=>{
  const b=browser(t),canvas=b.host.querySelector('.cw-qmap-canvas');assert.ok(canvas);
  assert.doesNotMatch(canvas.getAttribute('style')||'',/(?:^|;)\s*(?:min-)?width\s*:\s*(?:760|948)px/i);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:min-)?width\s*:\s*(?:760|948)px/i);
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)],scroll=rules.filter(([,selector])=>selector.split(',').some(part=>part.trim()==='.cw-qmap-scroll')).map(([, ,body])=>body).join(';');
  assert.match(scroll,/overflow-x\s*:\s*hidden/);assert.match(scroll,/overflow-y\s*:\s*auto/);
  const headers=rules.filter(([,selector])=>selector.split(',').some(part=>part.trim()==='.cw-qmap-lane-labels')).map(([, ,body])=>body).join(';');assert.match(headers,/grid-template-columns\s*:\s*repeat\(4\s*,/);
});

test('percentage node centers and the stretched SVG preserve dependency endpoints at mobile and desktop widths',t=>{
  const quest=plan();quest.paths.push({id:'unknown-path',realm:'unknown-system',title:'Unassigned work',steps:['Choose its subsystem']});
  const b=browser(t,quest),graph=b.api.project(quest),svg=b.host.querySelector('svg.cw-qmap-threads'),canvas=b.host.querySelector('.cw-qmap-canvas');
  assert.equal(graph.width,760);assert.equal(svg.getAttribute('preserveAspectRatio'),'none');const box=svg.getAttribute('viewBox').split(/\s+/).map(Number);assert.equal(box[2],760);assert.ok(box[3]>0);
  for(const item of b.host.querySelectorAll('[data-quest-map-graph-node]'))assert.match(item.style.getPropertyValue('--node-x').trim(),/^\d+(?:\.\d+)?%$/);
  for(const edge of svg.querySelectorAll('[data-edge-kind]')){
    const numbers=edge.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),from=canvas.querySelector(`[data-quest-map-graph-node="${edge.dataset.from}"]`),to=canvas.querySelector(`[data-quest-map-graph-node="${edge.dataset.to}"]`);assert.ok(from&&to);
    for(const width of[320,390,760]){
      const sourceCenter=parseFloat(from.style.getPropertyValue('--node-x'))/100*width,targetCenter=parseFloat(to.style.getPropertyValue('--node-x'))/100*width;
      assert.ok(Math.abs(numbers[0]/box[2]*width-sourceCenter)<.01,`source endpoint at ${width}px`);assert.ok(Math.abs(numbers.at(-2)/box[2]*width-targetCenter)<.01,`target endpoint at ${width}px`);
    }
  }
  assert.match(b.host.textContent,/Unassigned subsystem/);
});

test('saved progress counts actual accepted or completed beats without treating a completed path as completed work',t=>{
  const b=browser(t),summary=b.host.querySelector('[data-quest-map-progress]');assert.ok(summary);assert.equal(summary.dataset.completed,'3');assert.equal(summary.dataset.total,'7');assert.match(summary.textContent,/\b3\s*(?:of|\/)\s*7\b/);assert.doesNotMatch(summary.textContent,/\b(?:XP|reward|credits|verified)\b/i);
  const r=browser(t,plan(),{reported:true}),reported=r.host.querySelector('[data-quest-map-progress]');assert.ok(reported);assert.equal(reported.dataset.completed,'3');assert.equal(reported.dataset.total,'7');assert.match(reported.textContent,/reported/i);assert.match(r.host.textContent,/Proof is not included/);
});

test('art-off and Lud maps directly expose semantic details without hidden decorative images or SVG',t=>{
  const b=browser(t,plan(),{art:false});assert.equal(b.host.querySelectorAll('img,svg').length,0);assert.equal(b.host.querySelector('.cw-qmap-details').open,true);assert.equal(b.host.querySelectorAll('[data-quest-map-lane]').length,4);assert.ok(b.host.querySelector('button[data-quest-map-action="inspect"]'));
  b.win.document.documentElement.dataset.civweaveOperatingMode='lud';b.host.innerHTML=b.api.render(plan());assert.equal(b.host.querySelectorAll('img,svg').length,0);assert.equal(b.host.querySelector('.cw-qmap-details').open,true);
});

test('motion is finite, scoped to the map, and disabled for reduced motion',()=>{
  const animationDeclarations=[...css.matchAll(/(?:^|[;{])\s*animation(?:-iteration-count)?\s*:\s*([^;}]+)/gi)].map(match=>match[1]);assert.ok(animationDeclarations.length>0,'The polished map supplies finite expressive motion');assert.ok(animationDeclarations.some(value=>!/^none(?:!important)?$/i.test(value.trim())));assert.ok(animationDeclarations.every(value=>!/(?:infinite|Infinity)/i.test(value)));
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.cw-quest-pathway-map[^}]*animation\s*:\s*none\s*!important/s);assert.match(css,/\[data-motion=["']paused["']\][^{]*\{[^}]*(?:animation-play-state\s*:\s*paused|animation\s*:\s*none)/);
});

test('a normal tap dispatches exactly once and cancels its single 500ms hold timer',t=>{
  const b=browser(t),time=clock(b.win),calls=[];b.api.bind(b.host,item=>calls.push(plain(item)));const target=node(b);pointer(b.win,target,'pointerdown');assert.equal(time.timers.size,1);assert.equal([...time.timers.values()][0].delay,500);pointer(b.win,target,'pointerup');assert.equal(time.timers.size,0);target.click();time.advance(1000);assert.deepEqual(calls,[detail]);
});

test('a hold inspects through the same callback once and consumes only the following click',t=>{
  const b=browser(t),time=clock(b.win),calls=[];b.api.bind(b.host,item=>calls.push(plain(item)));const target=node(b);pointer(b.win,target.querySelector('strong'),'pointerdown');assert.equal(time.timers.size,1);time.advance(499);assert.equal(calls.length,0);time.advance(1);assert.deepEqual(calls,[detail]);assert.equal(time.timers.size,0);pointer(b.win,target,'pointerup');physicalClick(b.win,target);assert.equal(calls.length,1);pointer(b.win,target,'pointerdown');pointer(b.win,target,'pointerup');physicalClick(b.win,target);assert.deepEqual(calls,[detail,detail]);
});

test('keyboard inspection remains available when a long press has no following physical click',t=>{
  const b=browser(t),time=clock(b.win),calls=[];b.api.bind(b.host,item=>calls.push(plain(item)));const target=node(b);pointer(b.win,target,'pointerdown');time.advance(500);pointer(b.win,target,'pointerup');target.click();assert.deepEqual(calls,[detail,detail]);
});

for(const cancel of['pointerup','pointercancel','movement','pointerleave','scroll','focusout'])test(`${cancel} cancels hold inspection without dispatching another action`,t=>{
  const b=browser(t),time=clock(b.win),calls=[];b.api.bind(b.host,item=>calls.push(plain(item)));const target=node(b);pointer(b.win,target,'pointerdown');assert.equal(time.timers.size,1);if(cancel==='movement')pointer(b.win,target,'pointermove',{x:31});else if(cancel==='scroll'||cancel==='focusout')target.dispatchEvent(new b.win.Event(cancel,{bubbles:cancel==='focusout'}));else pointer(b.win,target,cancel);assert.equal(time.timers.size,0);time.advance(1000);assert.equal(calls.length,0);
});

test('movement of exactly ten pixels retains the hold while repeated binding retains one timer and current callback',t=>{
  const b=browser(t),time=clock(b.win),old=[],current=[];b.api.bind(b.host,item=>old.push(plain(item)));b.api.bind(b.host,item=>current.push(plain(item)));const target=node(b);pointer(b.win,target,'pointerdown');pointer(b.win,target,'pointermove',{x:30});assert.equal(time.timers.size,1);time.advance(500);assert.equal(old.length,0);assert.deepEqual(current,[detail]);
});

test('hold preserves the original pointer event and does not intercept scrolling or hold business actions',t=>{
  const b=browser(t,plan(),{actions:['inspect','edit','submit-guild']}),time=clock(b.win),calls=[];b.api.bind(b.host,(item,event)=>calls.push({item:plain(item),event}));const target=node(b),down=pointer(b.win,target,'pointerdown');assert.equal(down.defaultPrevented,false);time.advance(500);assert.equal(calls[0].event,down);assert.deepEqual(calls[0].item,detail);pointer(b.win,target,'pointerup');
  const edit=b.host.querySelector('[data-quest-map-action="edit"]');pointer(b.win,edit,'pointerdown');assert.equal(time.timers.size,0);time.advance(1000);assert.equal(calls.length,1);pointer(b.win,edit,'pointerup');edit.click();assert.equal(calls.length,2);assert.equal(calls[1].item.action,'edit');
});

test('disposal removes delegated listeners and pending timers without installing global listeners',t=>{
  const b=browser(t),time=clock(b.win),calls=[],active=new Map(),globalAdds=[];const add=b.host.addEventListener.bind(b.host),remove=b.host.removeEventListener.bind(b.host);
  b.host.addEventListener=(type,listener,...args)=>{const listeners=active.get(type)||new Set();listeners.add(listener);active.set(type,listeners);return add(type,listener,...args)};b.host.removeEventListener=(type,listener,...args)=>{active.get(type)?.delete(listener);if(active.get(type)?.size===0)active.delete(type);return remove(type,listener,...args)};
  for(const owner of[b.win,b.win.document]){const original=owner.addEventListener.bind(owner);owner.addEventListener=(...args)=>{globalAdds.push(args[0]);return original(...args)}}
  const dispose=b.api.bind(b.host,item=>calls.push(plain(item))),target=node(b);pointer(b.win,target,'pointerdown');assert.equal(time.timers.size,1);assert.ok(active.size>0);dispose();assert.equal(time.timers.size,0);assert.equal(active.size,0);time.advance(1000);target.click();assert.equal(calls.length,0);assert.deepEqual(globalAdds,[]);
});

test('the motion control pauses presentation independently without dispatching a Quest business action',t=>{
  const b=browser(t),calls=[];b.api.bind(b.host,item=>calls.push(plain(item)));const control=b.host.querySelector('button[data-quest-map-motion]');assert.ok(control);assert.equal(b.map.dataset.motion,'running');control.click();assert.equal(b.map.dataset.motion,'paused');assert.equal(calls.length,0);control.click();assert.equal(b.map.dataset.motion,'running');assert.equal(calls.length,0);
});

test('reduced-motion initial state agrees with the visible motion control and its pressed state',t=>{
  const b=browser(t),calls=[];b.win.matchMedia=query=>({matches:query==='(prefers-reduced-motion: reduce)'});b.host.innerHTML=b.api.render(plan());const map=b.host.querySelector('[data-quest-pathway-map]'),control=map.querySelector('[data-quest-map-motion]');assert.equal(map.dataset.motion,'paused');assert.equal(control.getAttribute('aria-pressed'),'true');assert.equal(control.textContent.trim(),'Resume effects');b.api.bind(b.host,item=>calls.push(plain(item)));control.click();assert.equal(map.dataset.motion,'running');assert.equal(control.getAttribute('aria-pressed'),'false');assert.equal(control.textContent.trim(),'Pause effects');assert.equal(calls.length,0);
});

test('inspecting another node clears the previous hold highlight as well as its selection',t=>{
  const b=browser(t),time=clock(b.win),calls=[];b.api.bind(b.host,item=>calls.push(plain(item)));const first=node(b),second=b.host.querySelector('[data-quest-map-graph-node="p0-s1"]');pointer(b.win,first,'pointerdown');time.advance(500);pointer(b.win,first,'pointerup');assert.equal(first.dataset.held,'true');assert.equal(first.dataset.selected,'true');second.click();assert.equal(first.dataset.held,undefined);assert.equal(first.dataset.selected,undefined);assert.equal(second.dataset.selected,'true');assert.equal(b.map.querySelectorAll('[data-selected="true"]').length,1);assert.equal(calls.length,2);assert.equal(calls[1].stepId,'learn-practice');
});

for(const interrupted of['hidden','focus'])test(`a pending hold cannot inspect after its document becomes ${interrupted==='hidden'?'hidden':'unfocused'}`,t=>{
  const b=browser(t),time=clock(b.win),calls=[];let hidden=false,focused=true;Object.defineProperty(b.win.document,'hidden',{configurable:true,get:()=>hidden});b.win.document.hasFocus=()=>focused;b.api.bind(b.host,item=>calls.push(plain(item)));const target=node(b);pointer(b.win,target,'pointerdown');assert.equal(time.timers.size,1);if(interrupted==='hidden')hidden=true;else focused=false;time.advance(500);assert.equal(calls.length,0);assert.equal(target.dataset.holding,undefined);assert.equal(target.dataset.held,undefined);assert.equal(time.timers.size,0);
});

test('a document that did not claim focus at pointerdown may still complete an otherwise valid hold',t=>{
  const b=browser(t),time=clock(b.win),calls=[];Object.defineProperty(b.win.document,'hidden',{configurable:true,value:false});b.win.document.hasFocus=()=>false;b.api.bind(b.host,item=>calls.push(plain(item)));pointer(b.win,node(b),'pointerdown');time.advance(500);assert.deepEqual(calls,[detail]);
});

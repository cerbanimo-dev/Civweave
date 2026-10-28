import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=name=>readFileSync(new URL(`../public/app/services/fellowfare/${name}`,import.meta.url),'utf8');
const marketKey='fellowfare.marketplace.v2',draftKey='civweave.fellowfare.listing-drafts.v1';
function fixture({listings=[],orders=[],drafts=[],contributions=[],scene,lud=false}={}){
  const dom=new JSDOM('<main id="main"></main><button data-ffc-command="market">Market</button><button data-ffc-command="loom">Sell</button><button data-ffc-command="assemblies">Orders</button><button data-ffc-command="inbox">Wallet</button>',{url:'https://civweave.test/app/fellowfare-cabinet-v144.html#market',runScripts:'outside-only',pretendToBeVisual:true}),{window}=dom;
  window.localStorage.setItem(marketKey,JSON.stringify({schema:'fellowfare.marketplace.v2',version:2,profile:{id:'me'},listings,orders,settings:{},migration:{legacySeedScrubbedAt:'fixture'}}));
  window.localStorage.setItem(draftKey,JSON.stringify(drafts));
  window.localStorage.setItem('civweave.fulfillment-economy.v1',JSON.stringify({schema:'civweave.fulfillment-economy.v1',contributions}));
  window.matchMedia=()=>({matches:false});
  if(lud)window.document.documentElement.dataset.civweaveOperatingMode='lud';
  if(scene===true)window.eval(readFileSync(new URL('../public/app/shared/guide-outcome-scene-v1.js',import.meta.url),'utf8'));
  else if(scene)window.CivweaveGuideOutcomeSceneV1=scene;
  window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=function(){};
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true};window.HTMLDialogElement.prototype.close=function(){this.open=false};
  window.fetch=async()=>{throw Error('No network during visual navigation')};
  window.eval(read('marketplace-v2.js'));window.dispatchEvent(new window.Event('DOMContentLoaded'));
  return{window,document:window.document,api:window.CivweaveFellowFareMarketplaceV2,close:()=>window.close()};
}
const listing=(id,title='Paper',status='open')=>({id,title,status,ownerId:'me',kind:'resource',mode:'offer',pricing:{gift:true},fulfillment:{},source:{system:'fellowfare',sourceId:id}});
const order=(id,status,title='Same arrangement')=>({id,title,status,listingId:'paper',note:'Fictional fixture only',updatedAt:'2026-10-27T09:00:00Z'});
const count=(document,key)=>document.querySelector(`[data-ff-flow-stage="${key}"] strong`)?.textContent;

test('the empty marketplace gives five usable flow stages without manufacturing progress or starting a transaction',()=>{
  const app=fixture();try{
    const {document,window}=app,before=window.localStorage.getItem(marketKey);
    assert.equal(document.querySelectorAll('[data-ff-flow-stage]').length,5);
    for(const key of ['draft','listing','arrange','delivery','complete'])assert.equal(count(document,key),'0');
    assert.match(document.querySelector('.ffv2-flow-map').textContent,/Local records/);
    document.querySelector('[data-ff-flow-stage="draft"]').click();
    assert.equal(document.body.dataset.ffRoute,'loom');
    assert.equal(document.querySelector('[data-ffc-command="loom"]').getAttribute('aria-current'),'page');
    assert.equal(window.localStorage.getItem(marketKey),before);
    assert.equal(document.querySelector('dialog[open]'),null);
  }finally{app.close()}
});

test('stage totals distinguish active work, fulfillment awaiting confirmation, completed records, and cancelled history',()=>{
  const app=fixture({listings:[listing('paper'),listing('closed','Old paper','closed')],orders:[order('pending','pending'),order('work','in-progress'),order('review','fulfilled'),order('done','completed'),order('cancel','cancelled'),order('unknown','not-completed')],drafts:[{id:'paper',title:'Already listed',kind:'resource',sourceId:'paper'},{id:'next',title:'Next Manifest',kind:'resource'}]});try{
    const {document}=app;
    assert.equal(count(document,'draft'),'1','A source already listed must not masquerade as an unlisted draft');
    assert.equal(count(document,'listing'),'1');assert.equal(count(document,'arrange'),'1');assert.equal(count(document,'delivery'),'2');assert.equal(count(document,'complete'),'1');
    assert.match(document.querySelector('.ffv2-flow-map').textContent,/1 awaiting confirmation/);
    assert.match(document.querySelector('.ffv2-flow-map').textContent,/1 cancelled/);
    assert.equal(document.querySelectorAll('[data-ff-flow-next]').length<=3,true,'The action queue must stay bounded');
    assert.equal(document.querySelector('progress'),null,'Separate stage totals are not a made-up completion percentage');
  }finally{app.close()}
});

test('flow controls open the canonical draft review, listing detail and exact arrangement without changing stored work',()=>{
  const app=fixture({listings:[listing('paper','<img src=x onerror=alert(1)>')],orders:[order('a','pending'),order('b','fulfilled')],drafts:[{id:'draft-one',title:'Review this Manifest',kind:'service'}]});try{
    const {document,window,api}=app,before=window.localStorage.getItem(marketKey);
    document.querySelector('.ffv2-flow-map [data-use-draft="draft-one"]').click();
    assert.equal(document.querySelector('#ffv2Composer').open,true);assert.equal(document.querySelector('#ffv2ComposerForm').elements.namedItem('title').value,'Review this Manifest');
    document.querySelector('#ffv2Composer').close();
    document.querySelector('.ffv2-flow-map [data-view-listing="paper"]').click();
    assert.equal(document.querySelector('#ffv2Detail').open,true);assert.equal(document.querySelector('#ffv2Detail h2').textContent,'<img src=x onerror=alert(1)>');assert.equal(document.querySelector('#ffv2Detail img'),null);
    document.querySelector('#ffv2Detail').close();
    document.querySelector('.ffv2-flow-map [data-open-order="b"]').click();
    assert.equal(document.body.dataset.ffRoute,'assemblies');
    assert.equal(document.activeElement.dataset.orderRecord,'b');
    assert.equal(document.querySelectorAll('[data-order-record="b"]').length,1);
    assert.equal(document.querySelector('[data-ffc-command="assemblies"]').getAttribute('aria-current'),'page');
    assert.equal(window.localStorage.getItem(marketKey),before,'Inspecting a stage must not publish, accept, fulfill, or pay');
    api.updateOrder('a','in-progress');assert.equal(count(document,'arrange'),'0');assert.equal(count(document,'delivery'),'2');
    assert.equal(window.localStorage.getItem('civweave.reward-ledger.v2'),null);
  }finally{app.close()}
});

test('order enhancement uses stable IDs when two arrangements have identical titles and statuses',()=>{
  const app=fixture({orders:[{...order('older','pending'),updatedAt:'2026-10-26T09:00:00Z'},order('newer','pending')]});try{
    app.window.eval(read('marketplace-v2-capabilities.js'));app.api.routeTo('assemblies');app.window.CivweaveFellowFareMarketplaceCapabilities.enhance();
    assert.equal(app.document.querySelector('[data-order-record="newer"] [data-ff-order-action]').dataset.ffOrderId,'newer');
    assert.equal(app.document.querySelector('[data-order-record="older"] [data-ff-order-action]').dataset.ffOrderId,'older');
  }finally{app.close()}
});

test('publishing a queued draft preserves its source identity so it leaves the unlisted stage',()=>{
  const app=fixture({drafts:[{draftId:'queued-manifest',title:'A queued local offer',kind:'service'}]});try{
    const {document,window}=app;document.querySelector('.ffv2-flow-map [data-use-draft="queued-manifest"]').click();
    const form=document.querySelector('#ffv2ComposerForm');assert.equal(form.dataset.sourceId,'queued-manifest');
    form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    const record=JSON.parse(window.localStorage.getItem(marketKey)).listings[0];assert.equal(record.source.sourceId,'queued-manifest');
    assert.equal(count(document,'draft'),'0');assert.equal(count(document,'listing'),'1');
    assert.equal(JSON.parse(window.localStorage.getItem(draftKey)).length,1,'The source draft is preserved rather than deleted');
  }finally{app.close()}
});

test('Rook scenes require a matching persisted completion contribution and never infer approval from closed, cancelled, or fulfilled text',()=>{
  const calls=[],app=fixture({orders:[order('done','completed'),order('closed','closed'),order('cancel','cancelled'),order('review','fulfilled')],contributions:[{orderId:'closed',completedAt:'2026-10-27T10:00:00Z'},{orderId:'cancel',completedAt:'2026-10-27T10:00:00Z'},{orderId:'review',completedAt:'2026-10-27T10:00:00Z'}],scene:{render:spec=>{calls.push(spec);return'<section data-test-scene></section>'}}});try{
    assert.equal(calls.length,0,'An order status or mismatched contribution must not create an acceptance scene');
    app.window.localStorage.setItem('civweave.fulfillment-economy.v1',JSON.stringify({contributions:[{orderId:'done',completedAt:'2026-10-27T10:01:00Z'}]}));app.api.render();
    assert.equal(calls.length,1);assert.equal(calls[0].guide,'fellowfare');assert.equal(calls[0].outcome,'accepted');assert.equal(calls[0].receiptId,'ff:done:'+Date.parse('2026-10-27T10:01:00Z'));assert.equal(calls[0].scope,'Locally recorded fulfillment');assert.equal(calls[0].fresh,false);
    assert.match(calls[0].note,/Payment and independent verification have their own records/);
    app.api.render();assert.equal(calls[1].receiptId,calls[0].receiptId,'Reopening preserves the same receipt identity');
  }finally{app.close()}
});

test('only a newly persisted completion with its contribution marks a scene fresh',()=>{
  const fresh=[],app=fixture({orders:[order('done','fulfilled')],scene:{render:()=>'<section></section>',markFresh:id=>fresh.push(id)}});try{
    app.api.updateOrder('done','completed');assert.deepEqual(fresh,[],'Changing status without a fulfillment contribution is insufficient');
    app.api.updateOrder('done','fulfilled');app.window.localStorage.setItem('civweave.fulfillment-economy.v1',JSON.stringify({contributions:[{id:'contribution:real-fixture',orderId:'done',completedAt:'2026-10-27T10:01:00Z'}]}));
    app.api.updateOrder('done','completed');assert.deepEqual(fresh,['contribution:real-fixture']);
    app.api.render();app.api.updateOrder('done','completed');assert.equal(fresh.length,1,'Ordinary render and repeated completion status do not replay the reward');
    assert.equal(app.window.localStorage.getItem('civweave.reward-ledger.v2'),null,'The scene adapter never issues a reward');
  }finally{app.close()}
});

test('the actual shared Rook/Lari presenter replays, stops, and survives a marketplace redraw without changing fulfillment',()=>{
  const app=fixture({scene:true,orders:[order('done','completed')],contributions:[{orderId:'done',completedAt:'2026-10-27T10:01:00Z'}]});try{
    const {document,window,api}=app,node=document.querySelector('[data-guide-outcome]'),before=window.localStorage.getItem(marketKey),fulfillment=window.localStorage.getItem('civweave.fulfillment-economy.v1');
    assert.equal(node.dataset.guide,'fellowfare');assert.equal(node.dataset.playing,'false');assert.match(node.textContent,/Fulfillment recorded/);assert.doesNotMatch(node.textContent,/Review accepted/);
    node.querySelector('[data-guide-scene-action="replay"]').click();assert.equal(node.dataset.playing,'true');
    api.render();assert.equal(document.querySelector('[data-guide-outcome]'),node);assert.equal(node.dataset.playing,'true');
    node.querySelector('[data-guide-scene-action="stop"]').click();assert.equal(node.dataset.playing,'false');
    assert.equal(window.localStorage.getItem(marketKey),before);assert.equal(window.localStorage.getItem('civweave.fulfillment-economy.v1'),fulfillment);
  }finally{app.close()}
});

test('a new actual contribution animates through the shared presenter and Lud keeps the same outcome without sprite art',()=>{
  for(const lud of [false,true]){
    const app=fixture({scene:true,lud,orders:[order('done','fulfilled')],contributions:[{orderId:'done',completedAt:'2026-10-27T10:01:00Z'}]});try{
      app.api.updateOrder('done','completed');const node=app.document.querySelector('[data-guide-outcome]');
      assert.equal(node.dataset.playing,String(!lud));assert.equal(Boolean(node.querySelector('[data-guide-sprite]')),!lud);assert.match(node.textContent,/Fulfillment recorded/);
      assert.equal(app.window.localStorage.getItem('civweave.reward-ledger.v2'),null);
    }finally{app.close()}
  }
});

for(const width of [320,390,1024])test(`the ${width}px flow keeps every stage in a wrapping grid with readable touch targets`,()=>{
  const app=fixture();try{
    const {window,document}=app,parser=document.createElement('style');parser.textContent=read('marketplace-v2.css');document.head.append(parser);
    const matches=query=>query.split(',').some(part=>{let valid=true;const rest=part.replace(/\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/gi,(_,kind,n)=>{valid&&=kind==='min'?width>=Number(n):width<=Number(n);return''}).replace(/\band\b|\bscreen\b|\ball\b/gi,'').trim();return valid&&!rest});
    const select=rules=>[...rules].flatMap(rule=>rule.type===4?(matches(rule.conditionText)?select(rule.cssRules):[]):rule.type===1?[rule.cssText]:[]);
    const sheet=select(parser.sheet.cssRules).join('\n');parser.remove();const style=document.createElement('style');style.textContent=sheet;document.head.append(style);
    const grid=window.getComputedStyle(document.querySelector('.ffv2-flow-stages'));
    assert.equal(grid.display,'grid');assert.match(grid.gridTemplateColumns,/repeat\(5,\s*minmax\(0(?:px)?,\s*1fr\)\)/);
    assert.equal(window.getComputedStyle(document.querySelector('.ffv2-flow-full')).display,width<=760?'none':'');
    for(const button of document.querySelectorAll('[data-ff-flow-stage]')){const computed=window.getComputedStyle(button);assert.equal(computed.minWidth,'0');assert.ok(parseFloat(computed.minHeight)>=44)}
  }finally{app.close()}
});

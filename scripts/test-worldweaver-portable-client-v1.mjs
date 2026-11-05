import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {COMMONS_BETWEEN} from '../public/app/shared/worldweaver-universe-v1.mjs';
import {LANTERN_MESH} from '../public/app/shared/worldweaver-lantern-mesh-v1.mjs';
import {exportPortableUniverseHtml} from '../public/app/shared/worldweaver-portable-client-v1.mjs';

class Element {
  constructor(tag='div'){
    this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.attributes={};
    this.value='';this.textContent='';this.hidden=false;this.checked=false;this.files=[];
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
  click(){this.listeners.click?.({preventDefault(){}});}
  remove(){}
}

function openOfflineFile(html,{storageAllowed=true}={}){
  const json=html.match(/<script id="cw-universe-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json&&script,'Complete embedded universe and executable client');
  const world=JSON.parse(json);
  const nodes={};
  const tabs=['map','quests','journal','guide'].map(tab=>{
    const button=new Element('button');button.dataset.tab=tab;return button;
  });
  const document={
    getElementById(id){return nodes[id]??(nodes[id]=new Element());},
    createElement(tag){return new Element(tag);},
    querySelectorAll(selector){return selector==='[data-tab]'?tabs:[];},
    body:new Element('body')
  };
  document.getElementById('cw-universe-data').textContent=json;
  const memory=new Map();
  const localStorage={
    getItem(k){if(!storageAllowed)throw new Error('storage denied');return memory.get(k)||null;},
    setItem(k,v){if(!storageAllowed)throw new Error('storage denied');memory.set(k,v);}
  };
  runInNewContext(script,{document,localStorage,URL:{},Blob:class{},setTimeout:()=>{}},{timeout:1500});
  return {world,nodes,tabs,memory,document};
}

for(const blueprint of [COMMONS_BETWEEN,LANTERN_MESH]){
  test(blueprint.id+' exports a real one-file portable client',()=>{
    const html=exportPortableUniverseHtml(blueprint);
    assert.match(html,/<!doctype html>/i);
    assert.doesNotMatch(html,/<script[^>]+src=/i);
    assert.doesNotMatch(html,/<link[^>]+href=/i);
    assert.doesNotMatch(html,/<iframe/i);
    const app=openOfflineFile(html);
    assert.equal(app.nodes['cw-world-title'].textContent,blueprint.title);
    assert.equal(app.nodes['cw-room-list'].children.length,blueprint.rooms?.length||blueprint.districts?.length);
    app.nodes['cw-room-list'].children[1].click();
    assert.ok(app.nodes['cw-current-room'].textContent.length>0);
    app.document.getElementById('cw-quest-title').value='Help the people here';
    app.nodes['cw-quest-form'].listeners.submit({preventDefault(){}});
    assert.equal(app.nodes['cw-quest-list'].children.length,1);
    const check=app.nodes['cw-quest-list'].children[0].children[0];
    check.checked=true;check.listeners.change();
    app.document.getElementById('cw-journal-text').value='Personal observation';
    app.nodes['cw-journal-form'].listeners.submit({preventDefault(){}});
    app.tabs[2].click();
    assert.equal(app.nodes['cw-panel-journal'].hidden,false);
    const saved=JSON.parse(app.memory.get('civweave.portable.world.'+blueprint.id+'.v1'));
    assert.equal(saved.quests[0].done,true);
    assert.equal(saved.journal[0],'Personal observation');
  });
}

test('untrusted titles are inert and do not terminate the embedded data script',()=>{
  const html=exportPortableUniverseHtml({
    id:'escape-test',title:'<script>window.pwned=1</script>',
    rooms:[{id:'one',title:'</script><script>window.pwned=2</script>'}]
  });
  assert.doesNotMatch(html,/<script>window\.pwned=/);
  const app=openOfflineFile(html);
  assert.equal(app.world.title,'<script>window.pwned=1</script>');
  assert.match(app.nodes['cw-current-room'].textContent,/script/);
});

test('storage failure keeps an explicitly session-only client',()=>{
  const html=exportPortableUniverseHtml({id:'memory-test',title:'Test',rooms:[{id:'room',title:'Room'}]});
  const app=openOfflineFile(html,{storageAllowed:false});
  assert.match(app.nodes['cw-storage'].textContent,/Session only/);
  app.document.getElementById('cw-quest-title').value='Unsaved work';
  app.nodes['cw-quest-form'].listeners.submit({preventDefault(){}});
  assert.equal(app.nodes['cw-quest-list'].children.length,1);
});

test('invalid and duplicate IDs and missing rooms fail closed',()=>{
  assert.throws(()=>exportPortableUniverseHtml(null),/Universe/);
  assert.throws(()=>exportPortableUniverseHtml({id:'../../escape',rooms:[{id:'x'}]}),/Universe ID/);
  assert.throws(()=>exportPortableUniverseHtml({id:'empty',rooms:[]}),/rooms/);
  assert.throws(()=>exportPortableUniverseHtml({id:'duplicate',rooms:[{id:'x'},{id:'x'}]}),/Room ID/);
});

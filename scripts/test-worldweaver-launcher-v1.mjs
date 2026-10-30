import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('public/app/persistent-shell-actions-v1.js');
const WORLD_ASSETS=['/app/worldweaver/index.html','/app/worldweaver/workspace.mjs','/app/worldweaver/workspace.css','/app/shared/worldweaver-core-v1.mjs','/app/shared/worldweaver-workspace-v1.mjs'];

function fixture(){
  const assigned=[];
  class Element{
    constructor(){this.children=[];this.dataset={};this.attributes={};this.handlers={};this.parentElement=null;this.isConnected=true}
    append(child){child.remove();child.parentElement=this;this.children.push(child)}
    prepend(child){child.remove();child.parentElement=this;this.children.unshift(child)}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null}
    setAttribute(name,value){this.attributes[name]=value}
    addEventListener(name,callback){this.handlers[name]=callback}
    querySelector(selector){const part=selector.split(' ').at(-1),matches=node=>part.startsWith('#')?node.id===part.slice(1):node.className===part.slice(1);for(const child of this.children){if(matches(child))return child;const result=child.querySelector(selector);if(result)return result}return null}
  }
  const head=new Element(),body=new Element(),nav=new Element(),utilities=new Element();
  nav.id='cw-themed-system-nav';utilities.className='cw-nav-utilities';body.append(nav);nav.append(utilities);
  const document={readyState:'complete',head,body,documentElement:body,scripts:[],createElement:()=>new Element(),getElementById:id=>head.querySelector('#'+id)||body.querySelector('#'+id),addEventListener(){}};
  const context={document,URL,Set,location:{href:'https://civweave.test/app/working-campus-v440.html',origin:'https://civweave.test',assign:path=>assigned.push(path)},MutationObserver:class{observe(){}disconnect(){}},addEventListener(){},setTimeout(){},console};
  vm.runInNewContext(source,context);
  return{api:context.CivweavePersistentShellActionsV1,actions:utilities.querySelector('#cw-persistent-shell-actions-v1'),utilities,assigned};
}

test('shared utility owner exposes Worldweaver beside every existing tool without starting a world',()=>{
  const app=fixture();
  assert.deepEqual([...app.actions.innerHTML.matchAll(/data-cw-persistent-action="([^"]+)"/g)].map(match=>match[1]),['guilds','map','survival','starling','worldweaver']);
  assert.match(app.actions.innerHTML,/aria-label="Open Worldweaver worldbuilding workspace"/);
  assert.match(app.actions.attributes['aria-label'],/Worldweaver/);
  assert.deepEqual(app.assigned,[],'mounting must not navigate, allocate a runtime, or trigger a model');
  for(let i=0;i<5;i++)app.api.ensureMounted();
  assert.equal(app.utilities.children.filter(node=>node.id===app.actions.id).length,1);
  let prevented=false;
  app.actions.handlers.click({target:{closest:()=>({dataset:{cwPersistentAction:'worldweaver'}})},preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.deepEqual(app.assigned,['/app/worldweaver/index.html']);
  assert.equal(app.api.openWorldweaver(),true);
  assert.equal(app.assigned.at(-1),'/app/worldweaver/index.html');
});

test('offline package and optional worker cache carry the complete workspace module graph',()=>{
  const pack=JSON.parse(read('public/app/offline-package-v208.json'));
  assert.ok(pack.seeds.includes(WORLD_ASSETS[0]),'the workspace entry remains an offline package root');
  for(const asset of WORLD_ASSETS.slice(1))assert.ok(pack.assets.includes(asset),`offline package missing ${asset}`);
  const context={REQUIRED_SHELL_ASSETS:[],OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],self:{}};
  vm.runInNewContext(read('public/service-worker-shell-assets-v1.js'),context);
  for(const asset of WORLD_ASSETS){assert.ok(context.OPTIONAL_SHELL_ASSETS.includes(asset),`optional cache missing ${asset}`);assert.ok(!context.REQUIRED_SHELL_ASSETS.includes(asset),'world workspace must not make shell installation fail');}
});

test('every active launcher loader and worker shell cache select the Worldweaver revision',()=>{
  const actionVersion='1.2.0-worldweaver-workspace',actionUrl=`/app/persistent-shell-actions-v1.js?v=${actionVersion}`;
  assert.equal(fixture().api.version,actionVersion);
  for(const path of ['public/app/system-routes-v227.js','public/app/persistent-system-shell-v1.html','public/app/cerbanimo-nav-stability-v1.js','public/app/working-campus-home-relocation-v441.js','public/app/worldweaver/index.html']){
    const actionUrls=read(path).match(/\/app\/persistent-shell-actions-v1\.js\?v=[^'"\s<>]+/g)||[];
    assert.deepEqual(actionUrls,[actionUrl],`${path} must load the current shared utility owner`);
  }
  const context={REQUIRED_SHELL_ASSETS:[],OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],self:{}};
  vm.runInNewContext(read('public/service-worker-shell-assets-v1.js'),context);
  const revision='shell-assets-v1-repair-v38-worldweaver-workspace';
  assert.equal(context.self.CivweaveShellAssetsV1.revision,revision);
  for(const path of ['public/service-worker-v203.js','scripts/build-service-worker-v211.mjs']){
    assert.ok(read(path).includes(`importScripts('/service-worker-shell-assets-v1.js?v=${revision}');`),`${path} must select the current shell asset revision`);
  }
  assert.ok(read('scripts/build-service-worker-v211.mjs').includes(`shellAssets:'${revision}'`),'worker build metadata must declare the same shell asset revision');
});

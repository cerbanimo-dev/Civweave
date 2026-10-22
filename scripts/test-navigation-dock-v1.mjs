import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app/persistent-shell-actions-v1.js',import.meta.url),'utf8');

function harness({withUtilities=true}={}){
  const observers=[],assigned=[];
  class Element{
    constructor(){this.children=[];this.dataset={};this.handlers={};this.parentElement=null;this.isConnected=true}
    append(child){child.remove();child.parentElement=this;this.children.push(child)}
    prepend(child){child.remove();child.parentElement=this;this.children.unshift(child)}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null}
    setAttribute(){}
    addEventListener(name,callback){this.handlers[name]=callback}
    querySelector(selector){
      const parts=selector.split(' '),match=node=>parts.at(-1).startsWith('#')?node.id===parts.at(-1).slice(1):node.className===parts.at(-1).slice(1);
      for(const child of this.children){if(match(child))return child;const found=child.querySelector(selector);if(found)return found}return null;
    }
  }
  const head=new Element(),body=new Element(),nav=new Element(),utilities=new Element();
  nav.id='cw-themed-system-nav';utilities.className='cw-nav-utilities';body.append(nav);if(withUtilities)nav.append(utilities);
  const document={readyState:'complete',head,body,documentElement:body,scripts:[],
    createElement:()=>new Element(),getElementById:id=>[head,body].map(root=>root.querySelector('#'+id)).find(Boolean)||null,addEventListener(){}};
  const context={document,URL,Set,location:{href:'https://civweave.test/app/persistent-system-shell-v1.html',origin:'https://civweave.test',assign:url=>assigned.push(url)},
    MutationObserver:class{constructor(callback){this.callback=callback;this.targets=[];observers.push(this)}observe(target,options){this.targets.push({target,options})}disconnect(){this.targets=[]}},
    addEventListener(){},setTimeout(){},console};
  vm.runInNewContext(source,context);
  return {api:context.CivweavePersistentShellActionsV1,nav,utilities,observers,assigned};
}

test('all utility actions remain inside the reserved dock through repeated mounts',()=>{
  const h=harness(),actions=h.utilities.querySelector('#cw-persistent-shell-actions-v1');
  assert.ok(actions,'the current action owner must mount into the shared utility row');
  assert.equal(actions.parentElement,h.utilities);
  for(let i=0;i<20;i++)assert.equal(h.api.ensureMounted(),true);
  assert.equal(h.utilities.children.filter(node=>node.id===actions.id).length,1,'remount must preserve one action group');
  assert.equal(h.utilities.children[0],actions);
  assert.match(actions.innerHTML,/Find nearby Guilds/);assert.match(actions.innerHTML,/Open Guild Map/);assert.match(actions.innerHTML,/Open Survival Mode/);
  h.api.openMap();h.api.openSurvival();
  assert.deepEqual(h.assigned,['/finder?view=map&source=persistent-shell','/app/survival/index.html']);
});

test('a late utility row receives the existing action owner without a floating fallback',()=>{
  const h=harness({withUtilities:false});
  assert.equal(h.nav.querySelector('#cw-persistent-shell-actions-v1'),null);
  h.nav.append(h.utilities);
  h.observers.find(observer=>observer.targets.some(row=>row.target===h.nav)).callback([]);
  assert.equal(h.utilities.querySelector('#cw-persistent-shell-actions-v1')?.parentElement,h.utilities);
});

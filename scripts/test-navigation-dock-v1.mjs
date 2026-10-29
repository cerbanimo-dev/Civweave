import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/persistent-shell-actions-v1.js',import.meta.url),'utf8');
const navigationSource=readFileSync(new URL('../public/app/themed-system-nav-v178.js',import.meta.url),'utf8');

function geometryFixture(t,{viewportWidth,popupWidth}={}){
  const dom=new JSDOM('<!doctype html><html data-persistent-system="anarchadia"><head></head><body></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=anarchadia',runScripts:'outside-only'}),{window}=dom;
  t.after(()=>window.close());
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  Object.defineProperty(window,'innerWidth',{value:viewportWidth,writable:true});Object.defineProperty(window,'innerHeight',{value:667,writable:true});
  window.setTimeout=()=>0;window.requestAnimationFrame=()=>0;
  window.CivweaveSubsystemAvatarStateV347={all:()=>({})};
  const box={width:popupWidth};
  window.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.id==='cw-themed-system-nav-menu')return{left:0,top:0,width:box.width,height:300};
    const index=['civweave','living-school','cerbanimo','fellowfare','anarchadia'].indexOf(this.dataset.system),width=window.innerWidth/5;
    return{left:Math.max(0,index)*width,top:521,width,height:102};
  };
  window.eval(navigationSource);
  return{window,box,open:()=>window.document.querySelector('.cw-nav-tools').click(),menu:()=>window.document.getElementById('cw-themed-system-nav-menu')};
}

test('rightmost guide shortcuts use the rendered mobile popup width and remain inside the viewport',t=>{
  const app=geometryFixture(t,{viewportWidth:390,popupWidth:374});app.open();
  const menu=app.menu(),left=Number.parseFloat(menu.style.left);
  assert.equal(menu.getAttribute('aria-label'),'Merlin shortcuts');assert.equal(menu.hidden,false);
  assert.ok(left>=8);assert.ok(left+app.box.width<=390-8,`Popup right edge ${left+app.box.width} must fit inside a390px viewport.`);
  assert.equal(left,8);
});

test('an open shortcut menu recomputes placement from its new rendered width after resize',t=>{
  const app=geometryFixture(t,{viewportWidth:1024,popupWidth:282});app.open();
  const menu=app.menu(),desktopLeft=Number.parseFloat(menu.style.left);
  assert.ok(desktopLeft>=8);assert.ok(desktopLeft+app.box.width<=1024-8);
  app.window.innerWidth=390;app.box.width=374;app.window.dispatchEvent(new app.window.Event('resize'));
  const mobileLeft=Number.parseFloat(menu.style.left);
  assert.equal(mobileLeft,8);assert.ok(mobileLeft+app.box.width<=390-8);
});

test('persistent shell travel closes the previous guide shortcuts and updates the selected guide',t=>{
  const app=geometryFixture(t,{viewportWidth:390,popupWidth:374});app.open();
  const previous=app.window.document.querySelector('[data-system="anarchadia"]');
  assert.equal(app.menu().hidden,false);assert.equal(previous.getAttribute('aria-expanded'),'true');
  app.window.document.documentElement.dataset.persistentSystem='fellowfare';
  app.window.history.replaceState({},'','?system=fellowfare');
  app.window.dispatchEvent(new app.window.CustomEvent('civweave:system-route-changed',{detail:{system:'fellowfare'}}));
  assert.equal(app.menu().hidden,true,'old guide actions must not remain over the new system');
  assert.equal(previous.getAttribute('aria-expanded'),'false');
  assert.equal(app.window.document.querySelector('[data-system="fellowfare"]').getAttribute('aria-current'),'page');
});

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

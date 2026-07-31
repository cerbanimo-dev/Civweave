import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

class StubElement {
  constructor(id='') {
    this.id=id; this.innerHTML=''; this.textContent=''; this.value=''; this.hidden=false; this.checked=false; this.disabled=false; this.open=false;
    this.dataset={}; this.files=[]; this.className=''; this.style={};
    this.classList={ toggle(){}, add(){}, remove(){}, contains(){return false;} };
  }
  addEventListener() {}
  setAttribute(name,value) { this[name]=value; }
  removeAttribute(name) { delete this[name]; }
  focus() {}
  setSelectionRange() {}
  showModal() { this.open=true; }
  close() { this.open=false; }
  append() {}
  appendChild() {}
  remove() {}
  reset() {}
}

function installDOM(hash) {
  const elements = new Map();
  const el = (selector) => {
    if (!elements.has(selector)) elements.set(selector,new StubElement(selector.replace(/^#/,'')));
    return elements.get(selector);
  };
  const listeners = new Map();
  const document = {
    documentElement:new StubElement('html'),
    body:new StubElement('body'),
    querySelector:el,
    querySelectorAll(){ return []; },
    addEventListener(type,handler){ if (!listeners.has(type)) listeners.set(type,[]); listeners.get(type).push(handler); },
    createElement(){ return new StubElement(); }
  };
  const storage = () => { const data=new Map(); return { getItem:k=>data.has(k)?data.get(k):null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k) }; };
  Object.defineProperty(globalThis,'document',{value:document,configurable:true});
  Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true});
  Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});
  Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});
  Object.defineProperty(globalThis,'location',{value:{hash,href:`http://example.test/${hash}`},configurable:true});
  Object.defineProperty(globalThis,'history',{value:{replaceState(){}},configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.addEventListener=()=>{};
  globalThis.scrollTo=()=>{};
  globalThis.alert=()=>{};
  globalThis.confirm=()=>true;
  globalThis.prompt=()=>null;
  return { elements, main:el('#main'), async dispatch(type,target){ for (const handler of listeners.get(type)||[]) await handler({target,stopPropagation(){},preventDefault(){}}); } }; 
}

async function renderRoute(route, expected) {
  const env=installDOM(`#${route}`);
  const url=pathToFileURL(join(root,'app.js')).href+`?render=${route}-${Date.now()}-${Math.random()}`;
  await import(url);
  if (!env.main.innerHTML.includes(expected)) throw new Error(`${route} route did not render expected marker: ${expected}`);
  return { html:env.main.innerHTML, env };
}

await renderRoute('market','Ask. Offer.');
const loomRender=await renderRoute('loom','Turn a market thread into a way forward.');
if (!loomRender.html.includes('Human authorization boundary') || !loomRender.html.includes('Run Loom analysis')) throw new Error('Loom safety boundary or action control missing');
const loomButton={ dataset:{aiAction:'matches',threadId:'t2'}, closest(){return this;} };
await loomRender.env.dispatch('click',loomButton);
await new Promise((resolve)=>setTimeout(resolve,20));
if (!loomRender.env.main.innerHTML.includes('Possible fulfillment paths')) throw new Error('Deterministic Loom click flow did not produce a result');
const settingsButton={ dataset:{aiSettings:''}, closest(){return this;} };
await loomRender.env.dispatch('click',settingsButton);
if (!loomRender.env.elements.get('#aiSettingsDialog').open) throw new Error('AI settings dialog did not open');
await renderRoute('assemblies','Multi-person exchange');
const deskRender=await renderRoute('inbox','Exchange Desk');
if (!deskRender.html.includes('Exchange ledger') || !deskRender.html.includes('Open ledger')) throw new Error('Exchange Desk agreement ledger missing');
const agreementButton={ dataset:{openAgreement:'ag1'}, closest(){return this;} };
await deskRender.env.dispatch('click',agreementButton);
if (!deskRender.env.elements.get('#detailDialog').open || !deskRender.env.elements.get('#detailContent').innerHTML.includes('Evidence custody')) throw new Error('Agreement ledger detail did not open');
const actionButton={ dataset:{ledgerAction:'evidence',agreementId:'ag1',milestoneId:'ms1'}, closest(){return this;} };
await deskRender.env.dispatch('click',actionButton);
if (!deskRender.env.elements.get('#ledgerActionDialog').open) throw new Error('Ledger action dialog did not open');
await renderRoute('profile','Commonweave bridge bundle');
console.log('Fellowfare route render tests passed.');

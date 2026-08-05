import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [html,css,source,worker]=await Promise.all([
  readFile(new URL('public/app/anarchadia-console-v139.html',root),'utf8'),
  readFile(new URL('public/app/anarchadia-passport-v193.css',root),'utf8'),
  readFile(new URL('public/app/anarchadia-passport-v193.js',root),'utf8'),
  readFile(new URL('public/service-worker-v156.js',root),'utf8')
]);

const must=(value,message)=>assert.ok(value,message);
new vm.Script(source,{filename:'anarchadia-passport-v193.js'});

for(const token of [
  'ac-passport-expanded','ac-passport-level','ac-passport-wallet-xp','ac-passport-wallet-acorns',
  'ac-passport-wallet-buttons','ac-passport-wallet-cotokens','ac-passport-skills','ac-passport-paths',
  'ac-passport-achievements','ac-passport-receipts','ac-passport-ownership-share',
  '/app/anarchadia-passport-v193.css','/app/anarchadia-passport-v193.js'
])must(html.includes(token),`Citizen Console is missing visible Passport token: ${token}`);

must(html.indexOf('ac-passport-expanded')<html.indexOf('ac-grid'), 'Expanded Passport must appear before the module grid on the home screen.');
must(!/ac-passport-expanded[^>]*hidden/i.test(html),'Expanded Passport must be visible by default.');
must(html.includes('Passport</b> · display only, never mints'),'The UI must state the Passport ledger boundary.');
must(html.includes('Share awaits a canonical network supply ledger.'),'Ownership percentage must not be invented without canonical supply.');

for(const token of ['commonweave.rewards.v156','commonweave.working-campus.v1','commonweave.intentions.v127','commonweave:rewards-changed','commonweave:proof-progress-synced','writesCanonicalLedgers:false'])must(source.includes(token),`Passport runtime is missing contract token: ${token}`);
must(!source.includes('localStorage.setItem('),'Passport runtime must not write or mint canonical ledger state.');
must(source.includes("document.querySelectorAll('[data-passport-refresh]')"),'Every visible Passport refresh control must be bound.');
must(source.includes("Math.floor(Math.sqrt(total/40))+1"),'Passport must use the canonical level curve.');

for(const token of ['@media(max-width:560px)','@media(prefers-reduced-motion:reduce)','ac-passport-wallet','ac-skill-list','ac-achievement-grid','ac-ownership-strip'])must(css.includes(token),`Passport styling is missing responsive/game UI token: ${token}`);

for(const token of ['working-campus-additions-v193-passport-exposed','anarchadia-passport-expanded-v193','/app/anarchadia-passport-v193.css','/app/anarchadia-passport-v193.js'])must(worker.includes(token),`Offline package is missing Passport token: ${token}`);

class Storage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
}
const context={
  console,Math,Date,JSON,Intl,Object,Array,Set,String,Number,Boolean,Map,Promise,
  localStorage:new Storage(),setTimeout:()=>0,requestAnimationFrame:()=>0,
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class {},
  document:{readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'anarchadia-passport-v193.js'});
const api=context.AnarchadiaPassportV193;
must(api,'Passport runtime did not export its API.');
assert.equal(api.ledgerAuthority,'display-only');
assert.equal(api.writesCanonicalLedgers,false);
assert.equal(api.levelState(0).level,1);
assert.equal(api.levelState(40).level,2);
assert.equal(api.levelState(160).level,3);

console.log(JSON.stringify({
  ok:true,
  revision:'anarchadia-passport-expanded-v193',
  visibleByDefault:true,
  sections:['level','wallet','skills','weave-paths','chronicles','achievements','receipts','ownership'],
  canonicalRewardStore:'commonweave.rewards.v156',
  ledgerAuthority:'display-only',
  offlinePackaged:true,
  mobileResponsive:true,
  reducedMotion:true
},null,2));

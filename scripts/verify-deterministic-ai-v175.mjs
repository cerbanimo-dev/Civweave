import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
await import('./verify-final-settings-retirement-v177.mjs');

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [gateway,controller,unified,delegation,deterministic,loader,boundary,campusTail]=await Promise.all([
  'public/app/settings-gateway-v317.js',
  'public/app/model-settings-controller-v173.js',
  'public/app/unified-ai-settings-v175.js',
  'public/app/settings-delegation-v175.js',
  'public/app/deterministic-mode-v175.js',
  'public/app/family-ai-loader-v105.js',
  'public/app/install-boundary-v146.js',
  'public/app/working-campus-v156.part5.txt'
].map(read));
for(const source of [gateway,controller,unified,delegation,deterministic,loader,boundary])new Function(source);

// Settings authority is singular; deterministic mode is a route, not a Settings owner.
assert.match(gateway,/globalThis\.CivweaveSettingsV320=api/);
assert.match(gateway,/inputOwner:true,presentationOwner:true,credentialOwner:true/);
assert.match(gateway,/<option value="deterministic">Deterministic local mode<\/option>/);
assert.match(gateway,/civweave-deterministic-v188/);
assert.match(controller,/compatibilityFacade:true/);
assert.match(controller,/canonical:'CivweaveSettingsV320'/);
assert.match(unified,/compatibilityFacade:true/);
assert.match(unified,/canonical:'CivweaveSettingsV320'/);
assert.match(delegation,/compatibilityFacade:true/);
assert.match(delegation,/canonical:'CivweaveSettingsV320'/);
for(const source of [controller,unified,delegation])assert.doesNotMatch(source,/document\.addEventListener\('click'/,'A retired Settings module regained click ownership.');

// Deterministic routing still migrates historical local aliases and stays non-authoritative for Settings.
assert.match(deterministic,/VERSION='175\.3-deterministic-minilm-template-planning'/);
assert.match(deterministic,/const LEGACY_LOCAL=new Set\(\['','bundled','packaged','reflex','minilm','local-reflex','smollm2','browser','deterministic'\]\)/);
assert.match(deterministic,/provider:'deterministic'/);
assert.match(deterministic,/transformerActive:false/);
assert.match(deterministic,/semanticPlanning:'lazy-explicit'/);
assert.match(loader,/defaultProvider:'deterministic'/);
assert.match(loader,/transformerActive:false/);
assert.doesNotMatch(boundary,/addScript\(MODEL_DOWNLOAD_SCRIPT\)/,'Install boundary regained the retired automatic legacy model-download path.');
assert.match(campusTail,/deterministic:'Deterministic local'/);

class MemoryStorage{constructor(seed={}){this.rows=new Map(Object.entries(seed))}getItem(key){return this.rows.has(key)?this.rows.get(key):null}setItem(key,value){this.rows.set(key,String(value))}removeItem(key){this.rows.delete(key)}}
const localStorage=new MemoryStorage({'civweave.universal-ai.v127':JSON.stringify({route:'bundled',provider:'bundled',model:'Xenova/all-MiniLM-L6-v2'})}),sessionStorage=new MemoryStorage(),events=[];
const sandbox={console,localStorage,sessionStorage,setInterval:()=>1,clearInterval(){},setTimeout(){},clearTimeout(){},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent:event=>events.push(event),globalThis:null};
sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(deterministic,sandbox,{filename:'deterministic-mode-v175.js'});
const migrated=JSON.parse(localStorage.getItem('civweave.universal-ai.v127'));
assert.equal(migrated.provider,'deterministic');
assert.equal(migrated.route,'deterministic');
assert.equal(sandbox.CivweaveDeterministicModeV175.transformerActive,false);
assert.equal(sandbox.CivweaveDeterministicModeV175.route('I need to borrow a trailer').system,'fellowfare');
assert.equal(sandbox.CivweaveDeterministicModeV175.route('I want to learn algebra').system,'living-school');

console.log(JSON.stringify({ok:true,revision:'deterministic-ai-v320-settings-owner',defaultProvider:'deterministic',settingsAuthority:'CivweaveSettingsV320',legacySettingsAuthorities:false,legacyBundledRouteMigrated:true,activeTransformerForDeterministicRoute:false,semanticPlanning:'lazy-explicit'},null,2));

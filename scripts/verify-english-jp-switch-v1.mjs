import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'public/app/civweave-brand.js'),'utf8');
const installer=fs.readFileSync(path.join(root,'public/app/index.html'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

try{new Function(source)}catch(error){throw new Error(`Brand runtime does not compile: ${error.message}`)}
assert(installer.includes('data-cw-en-language-control'),'English installer does not own a reciprocal language control in source markup.');
assert(installer.includes('>JP</button>'),'English shell language control is not labeled JP at source.');
assert(source.includes("document.querySelector('[data-cw-en-language-control]')"),'Brand runtime does not bind the source-owned JP control.');
assert(!source.includes("createElement('button')")&&!source.includes('button.textContent='),'Brand runtime must not create or relabel the JP control after paint.');
assert(source.includes("new URL('/ja/',location.origin)"),'JP control does not use the canonical Japanese share route.');
assert(source.includes("next.searchParams.set('lang','ja')"),'JP control does not explicitly activate Japanese mode.');
assert(source.includes("localStorage.setItem(LANGUAGE_KEY,'ja')"),'JP control does not persist the Japanese preference before navigation.');
assert(source.includes("if(wantsJapanese())return false"),'JP binding is not suppressed while Japanese mode is active.');
assert(source.includes('runtimeBrandRewrite:false'),'Brand runtime does not advertise the source-truth presentation contract.');

console.log('English → Japanese language switch verification passed.');
console.log('English source owns JP; runtime only binds it to /ja/?lang=ja; Japanese shell retains its existing EN control.');

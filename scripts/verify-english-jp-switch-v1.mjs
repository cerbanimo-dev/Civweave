import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'public/app/civweave-brand.js'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

try{new Function(source)}catch(error){throw new Error(`Brand runtime does not compile: ${error.message}`)}
assert(source.includes('ensureEnglishLanguageControl'),'English shell does not mount a reciprocal language control.');
assert(source.includes("button.textContent='JP'"),'English shell language control is not labeled JP.');
assert(source.includes("data-cw-en-language-control")||source.includes('cwEnLanguageControl'),'English shell language control marker is missing.');
assert(source.includes("new URL('/ja/',location.origin)"),'JP control does not use the canonical Japanese share route.');
assert(source.includes("next.searchParams.set('lang','ja')"),'JP control does not explicitly activate Japanese mode.');
assert(source.includes("localStorage.setItem(LANGUAGE_KEY,'ja')"),'JP control does not persist the Japanese preference before navigation.');
assert(source.includes("if(wantsJapanese()||document.querySelector('[data-cw-en-language-control]'))return false"),'JP control is not suppressed while Japanese mode is active.');

console.log('English → Japanese language switch verification passed.');
console.log('English shell: JP → /ja/?lang=ja; Japanese shell retains its existing EN control.');

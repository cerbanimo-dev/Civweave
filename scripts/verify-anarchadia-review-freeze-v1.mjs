import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/app/anarchadia-change-review-v165.js'),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

new Function(source);

assert(!/observer\.observe\(document\.documentElement\s*,\s*\{\s*childList\s*:\s*true\s*,\s*subtree\s*:\s*true\s*\}\)/.test(source),
  'Anarchadia change review must not observe the whole document subtree; its own decoration writes can create a self-sustaining mutation loop.');
assert(source.includes("document.querySelectorAll('#ac-proposal-list,#ac-pipeline-list')"),
  'Anarchadia change review must scope render observation to the two canonical proposal/pipeline list roots.');
assert(source.includes("observer.observe(list,{childList:true})"),
  'Anarchadia list observation must remain direct-child only so review decoration mutations do not feed back into the observer.');
assert(source.includes('if(controls.innerHTML!==markup)controls.innerHTML=markup'),
  'Merlin review controls must be idempotent and avoid rewriting identical markup.');

console.log(JSON.stringify({ok:true,observerScope:'proposal-and-pipeline-direct-children',merlinDecoration:'idempotent'},null,2));

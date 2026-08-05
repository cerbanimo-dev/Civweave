import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFile(path.join(root,relative),'utf8');
const [html,core,hardening,css]=await Promise.all([
  read('public/app/realm-console-v140.html'),
  read('public/app/cerbanimo-code-workshop-v204.js'),
  read('public/app/cerbanimo-code-workshop-hardening-v205.js'),
  read('public/app/cerbanimo-code-workshop-hardening-v205.css')
]);
const checks=[
  ['realm mounts core workshop',html.includes('cerbanimo-code-workshop-v204.js')],
  ['realm mounts hardening pass',html.includes('cerbanimo-code-workshop-hardening-v205.js')],
  ['realm mounts hardening styles',html.includes('cerbanimo-code-workshop-hardening-v205.css')],
  ['token is session only',core.includes('sessionStorage.setItem(TOKEN_KEY')&&!core.includes('localStorage.setItem(TOKEN_KEY')],
  ['pull requests are drafts',core.includes('draft:true')&&hardening.includes('draft:true')],
  ['protected path gate exists',core.includes('PROTECTED_DEFAULT')],
  ['per-file exclusion exists',hardening.includes('Exclude from PR')&&hardening.includes('includedFiles')],
  ['delete targets are verified',hardening.includes('missingDelete')],
  ['stage click is intercepted before legacy handler',hardening.includes("addEventListener('click',captureClick,true)")],
  ['quest proof receipts are attached',hardening.includes('addProof')&&hardening.includes('Git commit')],
  ['mobile review styling exists',css.includes('.ccw205-file-controls')&&css.includes('.is-excluded')]
];
const failed=checks.filter(([,ok])=>!ok);
for(const [label,ok] of checks)console.log(`${ok?'✓':'✗'} ${label}`);
if(failed.length)throw new Error(`${failed.length} Cerbanimo Code Workshop verification check(s) failed.`);
console.log(`Cerbanimo Code Workshop verification passed: ${checks.length}/${checks.length}.`);

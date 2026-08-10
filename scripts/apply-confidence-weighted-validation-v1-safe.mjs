#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const domainPath=resolve(repoRoot,'public/extensions/civweave-domain-bridge-v156.js');
const marker='/* confidence-weighted-validation-v1 */';

let domainSource=readFileSync(domainPath,'utf8');
if(!domainSource.includes(marker)){
  const replacements=[
    ['function qualifiedProvider(review={})','function qualifiedProvider(review)','default-object parameter'],
    ['async function recordPeerReview(','function recordPeerReview(','async function prefix'],
  ];
  let changed=false;
  for(const [from,to,label] of replacements){
    if(domainSource.includes(from)){
      domainSource=domainSource.replace(from,to);
      changed=true;
      console.log(`[confidence-validation] normalized legacy ${label} for deterministic transformation`);
    }
  }
  if(changed)writeFileSync(domainPath,domainSource,'utf8');
}

await import('./apply-confidence-weighted-validation-v1.mjs');

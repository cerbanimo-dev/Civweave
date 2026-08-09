#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const domainPath=resolve(repoRoot,'public/extensions/civweave-domain-bridge-v156.js');
const marker='/* confidence-weighted-validation-v1 */';
const defaultParamSignature='function qualifiedProvider(review={})';
const normalizedSignature='function qualifiedProvider(review)';

const domainSource=readFileSync(domainPath,'utf8');
if(!domainSource.includes(marker)&&domainSource.includes(defaultParamSignature)){
  writeFileSync(domainPath,domainSource.replace(defaultParamSignature,normalizedSignature),'utf8');
  console.log('[confidence-validation] normalized legacy qualifiedProvider signature for deterministic transformation');
}

await import('./apply-confidence-weighted-validation-v1.mjs');

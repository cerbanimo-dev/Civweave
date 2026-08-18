import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sourceUrl=new URL('../public/app/working-campus-home-declutter-v1.js',import.meta.url);

test('Civweave home menu exposes the canonical Patreon support action',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  assert.ok(source.includes('data-cw-home-support'),'Civweave home menu must expose a dedicated support action.');
  assert.ok(source.includes('href="https://www.patreon.com/c/Civweave"'),'Support action must use the canonical Civweave Patreon URL.');
  assert.ok(source.includes('target="_blank"'),'Patreon support must leave the installed PWA open.');
  assert.ok(source.includes('rel="noopener noreferrer external"'),'External Patreon navigation must use safe opener isolation.');
  assert.ok(source.includes('Support Civweave'),'Support action must be clearly labeled for users.');
});

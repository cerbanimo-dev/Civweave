import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=name=>readFileSync(new URL(`../public/app/${name}`,import.meta.url),'utf8');
const guide=source('guide-chat-surface-v350.js'),faces=source('shared-chat-face-icons-v255.js'),human=source('human-message-bubble-v1.js');
const rule=(text,selector)=>text.slice(text.indexOf(selector+'{')+selector.length+1).split('}')[0];
const layer=text=>Number(text.match(/z-index:(\d+)/)?.[1]);

test('persistent shell exposes the canonical AI launcher before the first chat shortcut',()=>{
  const html=source('persistent-system-shell-v1.html');
  assert.match(html,/<script src="\/app\/guide-chat-surface-v350\.js[^"\n]*" defer><\/script>/);
  assert.doesNotMatch(guide,/\b(?:prewarm|initializeModel|AutoModelForCausalLM)\s*\(/,'launcher startup must not initialize a model');
});

test('floating launchers remain behind both conversation windows',()=>{
  const chatLayer=layer(rule(guide,'#${ROOT_ID}'));
  assert.ok(chatLayer>0);
  for(const [name,text,selector] of [['AI',guide,'#${LAUNCHER_ID}'],['AI face style',faces,'#${LAUNCHER_ID}'],['human',human,'#${BUBBLE_ID}']]){
    assert.ok(layer(rule(text,selector))<chatLayer,`${name} launcher must not cover the composer`);
  }
});

test('chat header keeps manager and close controls in the same row',()=>{
  assert.match(faces,/#\$\{ROOT_ID\}\.cw295-thread-manager-ready>header\{grid-template-columns:[^}]*40px 40px!important/);
});

test('desktop chat height leaves room for navigation and a top inset on short screens',()=>{
  assert.match(rule(guide,'#${ROOT_ID}'),/height:min\([^;]*calc\(100dvh - var\(--cw-themed-nav-height,64px\)/);
});

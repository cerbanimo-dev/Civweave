import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../public/app/working-campus-v156.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/app/working-campus-v156.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/app/working-campus-v156.html', import.meta.url), 'utf8');

const checks = [
  ['Civweave remains the declared Working Campus system', () => assert.match(html, /data-civweave-system="civweave"/)],
  ['Working Campus header stays compact', () => {
    assert.match(css, /#brand-home\.brand\{grid-template-columns:64px/);
    assert.match(css, /#brand-home\.brand img\{width:64px!important;height:64px!important/);
    assert.doesNotMatch(runtime, /220px!important/);
    assert.doesNotMatch(runtime, /118px!important/);
  }],
  ['realm navigation stays a compact band', () => {
    assert.match(css, /\.app \.campus \.realm-node\{min-height:96px!important/);
    assert.match(css, /\.app \.campus \.realm-node img\{width:58px!important;height:58px!important/);
  }],
  ['medium viewports stack workspace and observation hub', () => {
    assert.match(css, /@media\(max-width:960px\)/);
    assert.match(css, /\.main,main\.app \.main:has\(#weaveling-hub-v233\)\{grid-template-columns:1fr!important\}/);
  }],
  ['diagnostics is opt-in instead of auto-placed', () => {
    assert.match(css, /#diagnostics-button\{display:none;grid-area:diagnostics/);
    assert.match(runtime, /dataset\.civweaveDiagnostics=enabled\?'true':'false'/);
    assert.match(runtime, /button\.hidden=!enabled/);
  }],
  ['old oversized brand injector is gone', () => {
    assert.equal(runtime.includes("style.id='cw-main-brand-v231'"), false);
    assert.equal(runtime.includes('.campus .realm-node{min-height:180px!important}'), false);
  }],
  ['browser install prompt is a slim strip', () => {
    assert.match(runtime, /min-height:34px/);
    assert.match(runtime, /font:700 14px\/1\.15 Georgia/);
  }],
  ['Civweave owns the closed shared-chat launcher', () => {
    assert.match(runtime, /civweave:persistent-guide-chat-ready/);
    assert.match(runtime, /switchGuide\?\.\('civweave'\)/);
    assert.match(runtime, /chat\.open\(\{guide:'civweave'\}\)/);
  }],
  ['bottom navigation publishes a shared safe-area height', () => assert.match(css, /--cw-themed-nav-height:58px/)],
  ['compact shell revision is explicit', () => assert.match(runtime, /BRAND_REVISION='compact-shell-v235'/)]
];

for (const [name, run] of checks) {
  run();
  console.log(`✓ ${name}`);
}

console.log(`Working Campus shell v235 verified: ${checks.length}/${checks.length} checks passed.`);

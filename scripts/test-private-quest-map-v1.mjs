import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await readFile(new URL('../public/app/shared-review-surface-v234.js', import.meta.url), 'utf8');
const key = 'civweave.intentions.v127';
function fixture() {
  return { id: 'weave:private-map', kind: 'weave-plan', state: 'review', plan: { id: 'weave:private-map', schema: 'civweave.intention-weave.v1', title: 'Fictional local repair', outcome: 'A steady fictional stool', state: 'review', paths: [
    { id: 'learn', realm: 'living-school', title: 'Learn the joint', steps: [{ id: 'inspect', title: 'Inspect the joint', status: 'accepted' }] },
    { id: 'build', realm: 'cerbanimo', title: 'Build the joint', steps: [{ id: 'assemble', title: 'Assemble the joint', status: 'review', dependsOn: ['inspect'] }] },
    { id: 'supply', realm: 'fellowfare', title: 'Gather materials', steps: ['Borrow a clamp'] },
    { id: 'consent', realm: 'anarchadia', title: 'Agree on use', steps: ['Review the workshop agreement'] },
    { id: 'unknown', realm: 'orbital-systems', title: 'Orbital check', steps: ['Check the fictional orbit'] },
  ] } };
}
async function browser(item = fixture()) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="weaveling-hub-v233"><div class="wh233-thread"></div></div><button data-gate="open-plan" data-id="weave:private-map">Review Quest</button></body></html>', { url: 'https://civweave.test/app/persistent-system-shell-v1.html', runScripts: 'outside-only' });
  const win = dom.window; win.structuredClone = structuredClone;
  win.localStorage.setItem(key, JSON.stringify([item]));
  const before = win.localStorage.getItem(key);
  let fetches = 0, writes = 0;
  win.fetch = async () => { fetches++; throw new Error('Private map must work without a hosted service.'); };
  const set = win.Storage.prototype.setItem;
  win.Storage.prototype.setItem = function (...args) { writes++; return set.apply(this, args); };
  win.eval(source);
  if (win.document.readyState === 'loading') win.dispatchEvent(new win.Event('DOMContentLoaded'));
  win.document.querySelector('[data-gate]').click();
  await new Promise(resolve => setImmediate(resolve));
  const map = () => win.document.querySelector('[data-private-quest-map]');
  return { win, map, before, get fetches() { return fetches; }, get writes() { return writes; }, close: () => win.close() };
}

test('the canonical personal review renders a private four-subsystem map without a Guild or network', async () => {
  const b = await browser();
  try {
    assert.ok(b.map(), 'the active shared review owner must render the personal Quest map');
    for (const [realm, title] of [['living-school', 'Inspect the joint'], ['cerbanimo', 'Assemble the joint'], ['fellowfare', 'Borrow a clamp'], ['anarchadia', 'Review the workshop agreement'], ['unassigned', 'Check the fictional orbit']]) {
      assert.match(b.map().querySelector(`[data-map-lane="${realm}"]`).textContent, new RegExp(title));
    }
    assert.match(b.map().querySelector('[data-map-lane="unassigned"]').textContent, /orbital-systems/);
    assert.doesNotMatch(b.map().querySelector('[data-map-lane="cerbanimo"]').textContent, /agreement|orbit/);
    assert.equal(b.fetches, 0);
    assert.equal(b.writes, 0);
    assert.equal(b.win.localStorage.getItem(key), b.before);
  } finally { b.close(); }
});

test('map nodes focus the existing path details without activating, publishing, or editing the plan', async () => {
  const b = await browser();
  try {
    const node = b.map()?.querySelector('[data-map-step="assemble"]');
    assert.ok(node, 'map task nodes must be semantic buttons');
    assert.equal(node.tagName, 'BUTTON');
    node.click();
    const target = b.win.document.querySelector('[data-review-path="1"]');
    assert.equal(b.win.document.activeElement, target);
    assert.match(target.textContent, /Assemble the joint/);
    assert.equal(b.writes, 0);
    assert.equal(JSON.parse(b.win.localStorage.getItem(key))[0].state, 'review');
  } finally { b.close(); }
});

test('dependency links use only declared references and plan order is labelled when dependencies are absent', async () => {
  const item = fixture(); item.plan.paths[1].steps[0].dependsOn.push('missing-source');
  const b = await browser(item);
  try {
    assert.ok(b.map());
    const edge = b.map().querySelector('[data-map-edge-from="inspect"][data-map-edge-to="assemble"]');
    assert.ok(edge);
    assert.match(edge.textContent, /Inspect the joint/);
    assert.match(b.map().textContent, /Unresolved dependency: missing-source/);
    assert.equal(b.map().querySelectorAll('[data-map-edge-from]').length, 1, 'adjacent plan items must not be invented as dependency edges');
    assert.match(b.map().querySelector('[data-map-lane="fellowfare"]').textContent, /Plan order/);
  } finally { b.close(); }
});

test('saved review and accepted step statuses remain visibly distinct', async () => {
  const b = await browser();
  try {
    assert.ok(b.map());
    assert.match(b.map().querySelector('[data-map-step="inspect"]').textContent, /Accepted/);
    assert.match(b.map().querySelector('[data-map-step="assemble"]').textContent, /Under review/);
    assert.equal(b.map().querySelector('[data-map-step="inspect"]').dataset.mapStatus, 'accepted');
    assert.equal(b.map().querySelector('[data-map-step="assemble"]').dataset.mapStatus, 'review');
    assert.doesNotMatch(b.map().textContent, /verified|proof accepted|100%/i);
  } finally { b.close(); }
});

test('large and hostile local plans produce a bounded inert map', async () => {
  const item = fixture();
  item.plan.paths = Array.from({ length: 20 }, (_, index) => ({ id: `path-${index}`, realm: index % 2 ? 'cerbanimo' : 'living-school', title: '<img src=x onerror="globalThis.mapXss=true">', steps: Array.from({ length: 100 }, (_, step) => ({ id: `step-${index}-${step}`, title: `<script>bad-${step}</script>` })) }));
  const b = await browser(item);
  try {
    assert.ok(b.map());
    assert.ok(b.map().querySelectorAll('[data-map-step]').length <= 96);
    assert.ok(b.map().querySelectorAll('[data-map-path]').length <= 12);
    assert.match(b.map().textContent, /Map preview.*12 of 20 paths/i);
    assert.equal(b.map().querySelector('img,script'), null);
    assert.equal(b.win.mapXss, undefined);
    assert.equal(b.writes, 0);
  } finally { b.close(); }
});

test('the existing explicit activation still owns state changes after map inspection', async () => {
  const b = await browser();
  try {
    assert.ok(b.map());
    b.map().querySelector('[data-map-step="assemble"]').click();
    assert.equal(b.writes, 0);
    b.win.document.querySelector('[data-review-command="activate-plan"]').click();
    assert.equal(JSON.parse(b.win.localStorage.getItem(key))[0].state, 'active');
    assert.ok(b.win.document.querySelector('[data-private-quest-map]'), 'the active Quest stays visible with its recorded plan decision');
    assert.equal(JSON.parse(b.win.localStorage.getItem(key))[0].plan.reviewDecision.decision, 'accepted');
    assert.match(b.win.document.querySelector('#cw-shared-review-surface-v234').textContent, /Quest plan activated/);
    assert.equal(b.win.document.querySelector('[data-review-command="activate-plan"]'), null, 'the recorded active plan cannot be activated again from review');
    await new Promise(resolve => setImmediate(resolve));
  } finally { b.close(); }
});

test('the existing separate Anarchadia governance layer is mapped and focuses its actual review details', async () => {
  const item = fixture(); item.plan.paths = item.plan.paths.filter(path => path.realm !== 'anarchadia');
  item.plan.governance = { title: 'Workshop agreement', purpose: 'Agree on the fictional workshop use', agreements: ['Ask before using shared equipment'], reviewQuestion: 'Who must consent?' };
  const b = await browser(item);
  try {
    const lane = b.map()?.querySelector('[data-map-lane="anarchadia"]');
    assert.match(lane?.textContent || '', /Workshop agreement/);
    lane.querySelector('button').click();
    assert.equal(b.win.document.activeElement, b.win.document.querySelector('[data-review-governance]'));
    assert.match(b.win.document.activeElement.textContent, /Ask before using shared equipment/);
    assert.equal(b.writes, 0);
  } finally { b.close(); }
});

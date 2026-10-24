import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/guide-chat-surface-v350.js', import.meta.url), 'utf8');
const streamSource = readFileSync(new URL('../public/app/guide-stream-thinking-v249.js', import.meta.url), 'utf8');

test('capability passover offers leave the target guide private until accepted', () => {
  const start = source.indexOf('function explicitHandoffTarget(');
  const end = source.indexOf('\nasync function submitActive(', start);
  const target = vm.runInNewContext(`${source.slice(start, end)};explicitHandoffTarget`, {
    clean: value => String(value ?? '').trim(),
    SYSTEMS: ['civweave', 'living-school', 'cerbanimo', 'fellowfare', 'anarchadia'],
  });
  const offer = {
    handoff: { kind: 'guide-capability-passover', targetSystem: 'living-school', resubmit: true },
    response: { handoffSystem: 'living-school' },
  };
  assert.equal(target(offer, 'civweave'), '', 'An offered passover must not append another private transcript or start its model.');
  assert.equal(target({ ...offer, handoff: { ...offer.handoff, acceptedAt: null } }, 'civweave'), '');
  assert.equal(target({ ...offer, handoff: { ...offer.handoff, acceptedAt: '2026-10-23T12:00:00.000Z' } }, 'civweave'), 'living-school');
  assert.equal(target({ handoffSystem: 'anarchadia' }, 'civweave'), 'anarchadia', 'Explicit handoffs retain their existing route.');
  assert.equal(target({ response: { handoffSystem: 'cerbanimo' } }, 'civweave'), 'cerbanimo');
  assert.equal(target({ handoff: { kind: 'guide-handoff', targetSystem: 'fellowfare' } }, 'civweave'), 'fellowfare');
  assert.equal(target({ handoffSystem: 'civweave' }, 'civweave'), '');
  assert.equal(target({ handoffSystem: 'unknown' }, 'civweave'), '');
});

class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.textWrites = 0; this.htmlWrites = 0; this._text = ''; this._class = ''; this.parentElement = null; }
  get className() { return this._class; }
  set className(value) { this._class = value; }
  get classList() { return { toggle: (name, enabled) => { const names = new Set(this._class.split(/\s+/).filter(Boolean)); enabled ? names.add(name) : names.delete(name); this._class = [...names].join(' '); } }; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.textWrites++; this._text = String(value); this.children.forEach(child => child.parentElement = null); this.children = []; }
  get innerHTML() { return ''; }
  set innerHTML(value) {
    this.htmlWrites++; this.children = [];
    for (const match of value.matchAll(/<article([^>]*)>([\s\S]*?)<\/article>/g)) {
      const article = new Element('article');
      for (const item of match[1].matchAll(/data-([\w-]+)="([^"]*)"/g)) article.dataset[item[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = item[2];
      article.className = match[1].match(/class="([^"]*)"/)?.[1] || '';
      if (article.dataset.role !== 'user') article.append(new Element('img'));
      const body = new Element('div'), bubble = new Element('div'); bubble.className = 'cw350-bubble';
      bubble.textContent = match[2].match(/class="cw350-bubble">([^<]*)/)?.[1] || '';
      body.append(bubble); article.append(body); this.append(article);
    }
  }
  get firstElementChild() { return this.children[0] || null; }
  get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...children) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child, cursor) { child.remove(); const index = cursor ? this.children.indexOf(cursor) : this.children.length; this.children.splice(index, 0, child); child.parentElement = this; return child; }
  remove() { if (this.parentElement) { const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this), 1); this.parentElement = null; } }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [], match = node => selector.startsWith('.') ? node.className.split(/\s+/).includes(selector.slice(1)) : selector === 'img' ? node.tagName === 'IMG' : selector === 'article[data-pending="true"]' ? node.tagName === 'ARTICLE' && node.dataset.pending === 'true' : false;
    for (const child of this.children) { if (match(child)) found.push(child); found.push(...child.querySelectorAll(selector)); }
    return found;
  }
}

function harness() {
  const log = new Element('div');
  let rows = [{ id: 'user-1', role: 'user', text: 'Hello' }, { id: 'reply-1', role: 'assistant', guide: 'civweave', text: 'Thinking', pending: true }];
  const guide = { name: 'Weaveling', avatar: '/weaveling.png' };
  const scope = {
    root: { querySelector: () => log, querySelectorAll: () => log.querySelectorAll('article[data-pending="true"]') },
    activeSystem: 'civweave', openState: true, GUIDE: { civweave: guide }, guide: () => guide,
    document: { createElement: tag => new Element(tag) },
    readThread: () => ({ messages: rows }), syncChrome() {}, markSeen() {}, syncSwitcher() {},
    requestAnimationFrame: callback => callback(), esc: value => String(value),
  };
  const start = source.indexOf('function render(){');
  const end = source.indexOf('async function fallbackReply(', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end), scope);
  return { log, scope, setRows: value => { rows = value; }, get rows() { return rows; } };
}

test('stream completion retains the article and bubble without rewriting the completed tokens', () => {
  const app = harness(); app.scope.render();
  const article = app.log.children[1], bubble = article.querySelector('.cw350-bubble');
  app.scope.paintNativeStream('civweave', 'reply-1', 'Hello from local AI');
  const writes = bubble.textWrites;
  app.setRows([app.rows[0], { id: 'reply-1', role: 'assistant', text: 'Hello from local AI', nextAction: 'Review your saved Quest.', provider: 'ollama', model: 'gemma4:latest' }]);
  app.scope.render();
  assert.equal(app.log.children[1], article, 'completion must keep the streamed article');
  assert.equal(article.querySelector('.cw350-bubble'), bubble, 'completion must keep the streamed bubble');
  assert.equal(bubble.textWrites, writes, 'the final token text is already present');
  assert.equal(article.dataset.pending, 'false');
  assert.equal(article.querySelector('.cw350-next').textContent, 'Next: Review your saved Quest.');
  assert.equal(article.querySelector('.cw350-meta').textContent, 'ollama · gemma4:latest');
  app.scope.render();
  assert.equal(bubble.textWrites, writes, 'later lifecycle updates must leave completed text alone');
});

test('appending a later turn preserves existing bubbles and their capability controls', () => {
  const app = harness(); app.scope.render();
  const article = app.log.children[1], bubble = article.querySelector('.cw350-bubble'), control = new Element('button');
  article.append(control);
  app.setRows([...app.rows, { id: 'user-2', role: 'user', text: 'Next request' }]);
  app.scope.render();
  assert.equal(app.log.children[1], article);
  assert.equal(article.querySelector('.cw350-bubble'), bubble);
  assert.equal(control.parentElement, article, 'subscriber capability controls must survive ordinary chat rendering');
  assert.equal(app.log.children.length, 3);
});

test('the stream subscriber delegates canonical painting and leaves the finished answer node intact', () => {
  const app = harness(); app.scope.render();
  const article = app.log.children[1], bubble = article.querySelector('.cw350-bubble');
  const query = article.querySelector.bind(article);
  article.querySelector = selector => selector === '.cw350-bubble,.cw237-bubble' ? bubble : query(selector);
  const owner = { canonicalOwner: true, activeWindow: () => 'civweave', paintStream: (system, text) => app.scope.paintStream(system, text) };
  const scope = { globalThis: { CivweaveGuideChatSurfaceV350: owner },
    document: { querySelector: () => ({ querySelectorAll: () => [article] }), createElement: tag => new Element(tag) },
    threadPending: () => true, finalizeIfDone() {}, esc: value => String(value),
  };
  const start = streamSource.indexOf('function thinkingMarkup('), end = streamSource.indexOf('\nfunction decorateInline(', start);
  const decorate = vm.runInNewContext(`${streamSource.slice(start, end)};decorateWorkspace`, scope);
  decorate('civweave', { thinking: 'Private reasoning', answer: 'Visible answer', done: false });
  assert.equal(bubble.textContent, 'Visible answer');
  const disclosure = bubble.parentElement.querySelector('.cw249-thinking');
  assert.ok(disclosure, 'Thinking is presented outside the canonical answer node.');
  assert.notEqual(disclosure.parentElement, bubble);
  const writes = bubble.textWrites;
  app.setRows([app.rows[0], { id: 'reply-1', role: 'assistant', text: 'Visible answer', provider: 'ollama' }]);
  app.scope.render();
  decorate('civweave', { thinking: 'Private reasoning', answer: '', done: true });
  assert.equal(app.log.children[1], article);
  assert.equal(article.querySelector('.cw350-bubble'), bubble);
  assert.equal(bubble.textWrites, writes, 'Completion must not clear or repaint the streamed answer.');
  assert.equal(bubble.parentElement.querySelector('.cw249-thinking'), disclosure, 'Disclosure updates preserve existing DOM.');
  assert.equal(disclosure.open, false);
});

test('the local token bridge respects the selected provider and preserves all callback arguments', async () => {
  const config = { provider: 'ollama', route: 'ollama' }, emitted = [], seen = [];
  const meta = { purpose: 'qa-stream' };
  const scope = {
    globalThis: { CivweaveModelRuntime: { readSharedConfig: () => config },
      CivweaveAssistantV141: { respond: async input => { input.onToken('piece', 'full answer', meta); return { response: { answer: 'full answer' } }; } } },
    localStorage: { getItem: () => JSON.stringify({ active: true, id: 'stale-browser-model' }) },
    LOCAL_SELECTION_KEY: 'selection', VERSION: 'qa', SYSTEMS: ['civweave'],
    parse: (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } },
    currentSystem: () => 'civweave', dispatchEvent: event => emitted.push(event),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  };
  const start = streamSource.indexOf('function selectedLocal('), end = streamSource.indexOf('\nfunction rehydrate(', start);
  const patch = vm.runInNewContext(`${streamSource.slice(start, end)};patchAssistant`, scope);
  patch();
  await scope.globalThis.CivweaveAssistantV141.respond({ systemId: 'civweave', onToken: (...args) => seen.push(args) });
  assert.equal(seen[0][1], 'full answer'); assert.equal(seen[0][2], meta);
  assert.equal(emitted.length, 0, 'A stale downloaded model must not relabel selected HTTP tokens.');
  config.provider = config.route = 'downloaded-local';
  await scope.globalThis.CivweaveAssistantV141.respond({ systemId: 'civweave', onToken: (...args) => seen.push(args) });
  assert.equal(seen[1][1], 'full answer'); assert.equal(seen[1][2], meta);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].detail.accumulatedText, 'full answer');
});

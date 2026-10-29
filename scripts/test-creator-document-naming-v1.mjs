import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const files = ['public/app/content-provenance-v1.js', 'public/creator-suite/text-editor-v1.js', 'public/creator-suite/project-browser-v1.js', 'public/creator-suite/index.html'];
const [provenanceSource, editorSource, browserSource, html] = await Promise.all(files.map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
// Isolated local-session tests; no actual user document, AI call or Guild publication.
function harness() {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { url: 'https://creator.example.test/creator-suite/', runScripts: 'outside-only' });
  const { window } = dom, sessions = new Map(), journals = new Map();
  Object.defineProperty(window, 'crypto', { value: webcrypto }); window.structuredClone = structuredClone; window.TextEncoder = TextEncoder;
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; }, set(value) { this.textContent = value; } });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const h = { dom, window, sessions, journals, fail: false, publications: 0 };
  window.CivweaveCreatorStoreV1 = { async putSession(value) { if (h.fail) throw new Error('Synthetic local storage failure'); sessions.set(value.id, structuredClone(value)); }, async listSessions() { return [...sessions.values()].map(value => structuredClone(value)); } };
  window.CivweaveCreatorCrashJournalV1 = { async checkpoint(value) { journals.set(value.session.id, structuredClone(value)); }, async restore(id) { return journals.get(id) || null; } };
  window.CivweaveCreatorGuildProvenanceV1 = { async publishReceipt() { h.publications++; } };
  window.CivweaveCreatorToolsV1 = { registerEditor() {} };
  window.eval(provenanceSource); window.eval(editorSource); window.eval(browserSource); window.CivweaveCreatorTextV1.init();
  return Object.assign(h, { api: window.CivweaveCreatorTextV1, provenance: window.CivweaveContentProvenanceV1 });
}

test('semantic Document name control persists a rename on the existing text session and reopens with its content', async () => {
  const h = harness();
  try {
    const input = h.window.document.querySelector('#cs-document-name'), save = h.window.document.querySelector('#cs-save-document-name');
    assert.ok(input && save, 'the active Text UI needs a usable naming control');
    assert.equal(h.window.document.querySelector('label[for="cs-document-name"]').textContent, 'Document name');
    const id = h.api.getSession().id; h.window.document.querySelector('#cs-text-editor').innerText = 'Qwen Local Readiness Checklist\n1. Keep a local copy.\n2. Reopen it.\n3. Verify history.';
    input.value = 'Qwen Local Readiness Checklist'; save.click();
    await new Promise(resolve => h.window.addEventListener('creator-suite:document-name-saved', resolve, { once: true }));
    const saved = h.sessions.get(id); assert.equal(saved.title, input.value); assert.equal(saved.id, id);
    assert.equal(saved.events.at(-1).type, 'document.rename'); assert.equal(saved.events.at(-1).actor.kind, 'human');
    assert.equal(saved.events.at(-1).payload.name, 'Qwen Local Readiness Checklist');
    assert.equal((await h.provenance.verifySession(saved)).valid, true);
    h.api.newSession(); await h.api.openSession(saved);
    assert.equal(h.window.document.querySelector('#cs-document-name').value, saved.title);
    assert.match(h.api.getText(), /3\. Verify history/); assert.equal(h.publications, 0);
  } finally { h.dom.window.close(); }
});

test('rename and pending human snapshot keep one intact provenance chain; unchanged names do not add events', async () => {
  const h = harness();
  try {
    h.window.document.querySelector('#cs-text-editor').innerText = 'A real local draft';
    await Promise.all([h.api.recordHumanSnapshot(), h.api.renameDocument('Named draft')]);
    const value = h.api.getSession(); assert.equal(value.events.filter(row => row.type === 'text.replace').length, 1); assert.equal(value.events.filter(row => row.type === 'document.rename').length, 1);
    assert.equal((await h.provenance.verifySession(value)).valid, true);
    await h.api.renameDocument('Named draft'); assert.equal(h.api.getSession().events.length, value.events.length);
    const tampered = structuredClone(value); tampered.events.at(-1).payload.name = 'Forged name';
    assert.equal((await h.provenance.verifySession(tampered)).valid, false);
  } finally { h.dom.window.close(); }
});

test('storage failure leaves the previous persisted name intact and displays the error; finalized sessions cannot rename', async () => {
  const h = harness();
  try {
    await h.api.renameDocument('Saved name'); const before = structuredClone(h.api.getSession()); h.fail = true;
    const input = h.window.document.querySelector('#cs-document-name'); input.value = 'Unsaved name'; h.window.document.querySelector('#cs-save-document-name').click();
    await new Promise(resolve => h.window.addEventListener('creator-suite:document-name-error', resolve, { once: true }));
    assert.match(h.window.document.querySelector('#cs-document-name-status').textContent, /storage failure/i);
    assert.equal(h.api.getSession().title, before.title); assert.equal(h.sessions.get(before.id).title, before.title);
    h.fail = false; const finalized = await h.provenance.finalizeSession(h.api.getSession()); await h.api.sealSession(finalized.session);
    assert.equal(input.readOnly, true); assert.equal(h.window.document.querySelector('#cs-save-document-name').disabled, true);
    await assert.rejects(h.api.renameDocument('Forbidden rename'), /finalized/i);
    assert.equal(h.api.getSession().title, before.title); assert.equal(h.publications, 0);
  } finally { h.dom.window.close(); }
});

test('Projects shows names as literal text and opening a named project does not interpret markup', async () => {
  const h = harness();
  try {
    await h.api.renameDocument('<img src=x onerror=alert(1)>');
    await h.window.CivweaveCreatorProjectBrowserV1.open('text');
    const card = h.window.document.querySelector('.cs-project-card');
    assert.equal(card.querySelector('strong').textContent, '<img src=x onerror=alert(1)>'); assert.equal(card.querySelector('img'), null);
    assert.equal(h.publications, 0);
  } finally { h.dom.window.close(); }
});

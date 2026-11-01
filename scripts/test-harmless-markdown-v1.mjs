import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderHarmlessMarkdown} from '../public/app/shared/harmless-markdown-v1.mjs';
test('Markdown presents headings, dialogue and emphasis as accessible DOM without injecting HTML',()=>{
 const dom=new JSDOM('<main id="reader"></main>');
 const target=dom.window.document.getElementById('reader');
 renderHarmlessMarkdown(target,'# HARMLESS.md\n\n### POST 0001 — WICK\n\n**Faith.** Some *wonder* and `code`.\n> A question.\n> A reply.\n\n<script>globalThis.hacked=true</script>');
 assert.equal(target.querySelector('h2').textContent,'HARMLESS.md');
 assert.equal(target.querySelector('strong').textContent,'Faith.');
 assert.equal(target.querySelector('em').textContent,'wonder');
 assert.equal(target.querySelectorAll('blockquote').length,1);
 assert.equal(target.querySelectorAll('script').length,0);
 assert.match(target.textContent,/<script>/);
});
test('Markdown renderer bounds visible characters and makes full export available',()=>{
 const dom=new JSDOM('<main></main>');
 const target=dom.window.document.querySelector('main');
 renderHarmlessMarkdown(target,'# HARMLESS.md\n'+'x'.repeat(400000),{maxChars:2000});
 assert.match(target.textContent,/Export/);
 assert.ok(target.textContent.length<3000);
});

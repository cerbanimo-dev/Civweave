import test from 'node:test';
import assert from 'node:assert/strict';
import {paginate, normalizeSpotify, normalizeCue, activeCues, chooseCue, exportCueSheet, importCueSheet, readerStorageKey} from '../public/app/shared/maggieverse-reader-core.mjs';

test('stable reader pages and forward progress', () => {
  const text = ('One paragraph in an imaginary universe. '.repeat(220) + '\n\nThe end.');
  const pages = paginate(text, 520);
  assert.ok(pages.length > 10);
  assert.ok(pages.every((p) => p.length > 0 && p.length <= 530));
  assert.match(pages.at(-1), /The end/);
  assert.equal(pages.join(' ').replace(/\s+/g,' ').trim(), text.replace(/\s+/g,' ').trim());
});

test('Spotify URLs are restricted to genuine playlist/track identifiers', () => {
  const track = 'https://open.spotify.com/track/0123456789012345678901?si=xyz';
  assert.equal(normalizeSpotify(track).url,'https://open.spotify.com/track/0123456789012345678901');
  assert.equal(normalizeSpotify('spotify:playlist:0123456789012345678901').type,'playlist');
  for (const value of ['javascript:alert(1)','https://evil.com/track/0123456789012345678901','https://open.spotify.com.evil.com/track/0123456789012345678901','https://open.spotify.com/episode/0123456789012345678901']) {
    assert.equal(normalizeSpotify(value), null);
  }
});

test('single-page song cue outranks a longer playlist range without triggering playback', () => {
  const a = normalizeCue({kind:'playlist',startPage:2,endPage:9,url:'spotify:playlist:0123456789012345678901',label:'Chapter atmosphere'},20);
  const b = normalizeCue({kind:'track',startPage:5,endPage:5,url:'spotify:track:1123456789012345678901',label:'Turning point'},20);
  assert.equal(activeCues([a,b],1).length, 0);
  assert.equal(chooseCue([a,b],3)?.id,a.id);
  assert.equal(chooseCue([a,b],5)?.id,b.id);
  assert.equal(chooseCue([a,b],10),null);
  assert.equal(normalizeCue({kind:'track',startPage:3,endPage:5,url:b.url},20),null);
});

test('cue sheet import validates lengths, kinds, URLs and book identity', () => {
  const book='unit-test-book';
  const data=exportCueSheet(book,[{kind:'playlist',startPage:1,endPage:2,url:'spotify:playlist:0123456789012345678901',label:'Prelude'}],18);
  const parsed=importCueSheet(data,book,18);
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].endPage,2);
  assert.throws(()=>importCueSheet(data,'different-book',18),/different book/);
  assert.equal(readerStorageKey('X'.repeat(200)).length < 160,true);
});


test('Golden Path maps an imported manuscript into bounded, optional reading waypoints', async () => {
  const {buildGoldenPath, goldenWaypointForPage}=await import('../public/app/shared/maggieverse-reader-core.mjs');
  const pages=['# Opening\\n\\nThe beginning.','Ordinary story.','Chapter 2: Discovery\\n\\nA new chapter.','The middle.','Epilogue\\n\\nThe end.'];
  const before=pages.slice();
  const path=buildGoldenPath(pages);
  assert.equal(path.schema,'civweave.reader-golden-path.v1');
  assert.equal(path.pageCount,5);
  assert.equal(path.stops[0].page,1);
  assert.ok(path.stops.some(stop=>stop.page===3 && /Discovery/.test(stop.title)));
  assert.ok(path.stops.every(stop=>stop.page>=1 && stop.page<=5 && stop.invitation));
  assert.equal(goldenWaypointForPage(path,4).page,3);
  assert.deepEqual(pages,before,'The original manuscript must remain untouched');
  assert.ok(!JSON.stringify(path).includes('Ordinary story.'),'Do not copy book text into metadata');
});
test('Golden Path fallback handles short texts and bounds oversized input', async () => {
  const {buildGoldenPath,goldenWaypointForPage}=await import('../public/app/shared/maggieverse-reader-core.mjs');
  const one=buildGoldenPath(['Once upon a time.']);
  assert.deepEqual(one.stops.map(stop=>stop.page),[1]);
  const plain=buildGoldenPath(Array.from({length:20},(_,i)=>'Page '+i+' without headings'));
  assert.ok(plain.stops.length>=4 && plain.stops.length<=8);
  assert.deepEqual(plain.stops.map(stop=>stop.page),[...new Set(plain.stops.map(stop=>stop.page))]);
  assert.equal(goldenWaypointForPage(plain,1000).page,20);
  assert.throws(()=>buildGoldenPath([]),/pages/i);
  assert.throws(()=>buildGoldenPath(Array(12001).fill('x')),/pages/i);
});
test('reader exposes an opt-out of the golden overlay, not an unreviewed child-safety filter', async () => {
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../public/app/maggieverse-reader.html',import.meta.url),'utf8');
  assert.match(html,/id="golden-mode"/);
  assert.match(html,/id="golden-path"/);
  assert.match(html,/id="export-golden-path"/);
  assert.match(html,/not a content-safety filter/i);
  assert.match(html,/CCCAMIRYNCIVWEAVE>CC/);
});

console.log('maggieverse reader: ok');


test('Civweave shell exposes the reader through the one native page and themed navigation owner', async () => {
  const fs=await import('node:fs/promises');
  const shell=await fs.readFile(new URL('../public/app/persistent-system-shell-v1.js',import.meta.url),'utf8');
  const bootstrap=await fs.readFile(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');
  const nav=await fs.readFile(new URL('../public/app/themed-system-nav-v178.js',import.meta.url),'utf8');
  const reader=await fs.readFile(new URL('../public/app/maggieverse-reader.html',import.meta.url),'utf8');
  assert.match(shell,/reader:\s*['"]\/app\/maggieverse-reader\.html['"]/);
  assert.match(bootstrap,/maggieverse-reader\.html/);
  assert.match(nav,/id:'reader',label:'Soundtrack Reader'/);
  assert.match(reader,/data-civweave-system="civweave"/);
  assert.match(reader,/id="book-shelf"/);
  assert.match(reader,/id="bookmark"/);
  assert.match(reader,/id="edit-cue"/);
  assert.match(reader,/id="open-playlist-plan"/);
  assert.doesNotMatch(reader,/api\.spotify\.com\/v1\/me\/player/);
});
test('book library layer is explicitly device-local with a bounded record size', async () => {
  const fs=await import('node:fs/promises');
  const library=await fs.readFile(new URL('../public/app/shared/maggieverse-reader-library.mjs',import.meta.url),'utf8');
  assert.match(library,/indexedDB\.open/);
  assert.match(library,/MAX_LOCAL_BOOK_TEXT/);
  assert.match(library,/deleteBook/);
  assert.doesNotMatch(library,/fetch\s*\(/);
});

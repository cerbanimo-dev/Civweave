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

console.log('maggieverse reader: ok');

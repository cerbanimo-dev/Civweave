import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');
const [cabinet,contrast,symbols]=await Promise.all([
  read('public/app/services/fellowfare/cabinet.html'),
  read('public/app/services/fellowfare/marketplace-v2-contrast.css'),
  read('public/app/services/fellowfare/marketplace-v2-symbols.js')
]);

assert.doesNotThrow(()=>new Function(symbols),'FellowFare currency-symbol runtime has invalid JavaScript.');
assert.ok(cabinet.includes('marketplace-v2-symbols.js?v=currency-symbols-r1'),'Active FellowFare cabinet does not load the currency-symbol helper.');
assert.ok(cabinet.includes('marketplace-v2-contrast.css?v=contrast-live-r3'),'Active FellowFare cabinet is not cache-busted onto contrast r3.');
assert.match(symbols,/button:'🔘'/,'Button symbol is missing.');
assert.match(symbols,/acorn:'🌰'/,'Acorn symbol is missing.');
assert.match(symbols,/function format\(term\)/,'Canonical currency formatting helper is missing.');
assert.match(symbols,/postPaintDecoration:false/,'FellowFare must declare post-paint currency decoration disabled.');
assert.doesNotMatch(symbols,/createTreeWalker|MutationObserver|\.replaceWith\s*\(/,'FellowFare currency helper must not crawl or replace rendered text.');
assert.match(symbols,/data-ff-copy-wallet/,'Wallet copy output is not intercepted for canonical symbols.');
assert.match(symbols,/data-ff-cap-share/,'Shared listing terms are not intercepted for canonical symbols.');
for(const token of [
  'background:#fff9e8!important',
  'color:#153849!important',
  '-webkit-text-fill-color:#153849!important',
  'color:#75634e!important',
  '.ffv2-currency-symbol',
  '.ffv2-empty h2',
  '.ffv2-wallet-strip small',
  '.ffv2-section-head>p',
  'color:#425958!important',
  'color:#ffe8b6!important',
  'color-scheme:light!important'
])assert.ok(contrast.includes(token),`FellowFare contrast r3 is missing ${token}`);

console.log('FellowFare symbols + contrast r3 verification passed with source-truth rendering and no DOM text decorator.');

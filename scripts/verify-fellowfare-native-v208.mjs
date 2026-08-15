import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=file=>fs.readFile(file,'utf8');
const [html,css,native,fulfillment,marketplace]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-native-v208.css'),
  read('public/app/fellowfare-native.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2.js')
]);

assert.match(html,/data-build="fellowfare-native-market"/,'canonical native FellowFare build marker missing');
assert.doesNotMatch(html,/<iframe\b/i,'nested marketplace iframe is active again');
for(const retired of [
  '/app/fellowfare-native-host-v207.js',
  '/app/fellowfare-native-scroll-v208.js',
  '/app/fellowfare-cabinet-v144.js',
  '/app/fellowfare-mobile-flow-v205.js',
  '/app/services/fellowfare/app.js',
  '/app/services/fellowfare/fulfillment-economy-v1.js'
]) assert.ok(!html.includes(retired),`retired FellowFare runtime returned: ${retired}`);

for(const required of [
  '/app/fellowfare-native.js',
  '/app/services/fellowfare/marketplace-v2.js',
  '/app/services/fellowfare/fulfillment-economy-v2.js'
]) assert.ok(html.includes(required),`canonical FellowFare surface missing ${required}`);

for(const token of ['CivweaveFellowFareMarketplaceV2','routeTo(route)','[data-ffc-command]','fellowfareScrollOwner','document-root'])
  assert.ok(native.includes(token),`direct native bridge missing ${token}`);
for(const forbidden of ['contentWindow','contentDocument','postMessage','MutationObserver',"createElement('script')",'new Function','eval('])
  assert.ok(!native.includes(forbidden),`direct native bridge contains retired/injecting behavior: ${forbidden}`);

assert.match(marketplace,/routeTo/,'marketplace v2 no longer exposes direct routing');
assert.match(marketplace,/CivweaveFellowFareMarketplaceV2/,'marketplace v2 global API missing');
for(const token of ['overflow-y:auto!important','overflow-y:visible!important','.ff-fulfillment-quest-grid strong','.ffv2-trust-empty h2','.ffv2-profile-card small'])
  assert.ok(css.includes(token),`native FellowFare CSS missing ${token}`);
assert.match(fulfillment,/SELF_MUTATION_SELECTOR='#ffFulfillmentDaily,#ffDirectMerchant,.ffv2-money-panel,.ffv2-policy-note'/,'fulfillment self-mutation guard missing');

console.log('FellowFare native verification passed: direct marketplace routing, one document scroll owner, no iframe compatibility layer, and no runtime code injection in the native bridge.');

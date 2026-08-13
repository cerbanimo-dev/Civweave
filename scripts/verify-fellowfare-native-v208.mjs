import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const [html,css,scroll,parent,fulfillment]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-native-v208.css'),
  read('public/app/fellowfare-native-scroll-v208.js'),
  read('public/app/fellowfare-cabinet-v144.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js')
]);
assert(html.includes('data-build="fellowfare-native-market-v208"'),'native FellowFare v208 build marker missing');
assert(!html.includes('<iframe id="ffc144-workbench"'),'nested marketplace iframe is active again');
assert(!html.includes('<script src="/app/fellowfare-mobile-flow-v205.js'),'retired cross-document height observer is active again');
for(const token of ['/app/fellowfare-native-v208.css?v=native-v208','/app/fellowfare-native-scroll-v208.js?v=native-v208','/app/services/fellowfare/marketplace-v2.js?v=native-v208'])assert(html.includes(token),`native v208 surface missing ${token}`);
assert(html.indexOf('/app/fellowfare-cabinet-v144.js?v=native-v208')<html.indexOf('/app/fellowfare-native-scroll-v208.js?v=native-v208'),'scroll-owner correction must load after the retained compatibility controller');
for(const token of ['overflow-y:auto!important','overflow-y:visible!important','.ff-fulfillment-quest-grid strong','.ffv2-trust-empty h2','.ffv2-profile-card small'])assert(css.includes(token),`native v208 CSS missing ${token}`);
assert(scroll.includes("set(root,'overflow-y','auto')"),'document root is not the declared scroll owner');
assert(scroll.includes("set(body,'overflow-y','visible')"),'body can still become a competing scroll owner');
assert(scroll.includes("type==='fellowfare:cabinet-ready'"),'native scroll correction does not repair the retained cabinet-ready callback');
assert(scroll.includes("body.classList.remove('ffc144-mobile-flow')"),'legacy mobile frame mode can still reactivate');
assert(parent.includes('function enableNestedScroll()'),'test no longer covers the compatibility regression source');
assert(fulfillment.includes("SELF_MUTATION_SELECTOR='#ffFulfillmentDaily,#ffDirectMerchant,.ffv2-money-panel,.ffv2-policy-note'"),'fulfillment self-mutation guard missing');
console.log('FellowFare native v208 verification passed: one root owns scroll, legacy nested-scroll writes are corrected, native contrast is explicit, and the marketplace remains iframe-free.');

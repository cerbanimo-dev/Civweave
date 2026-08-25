import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const [html,css,scroll,parent,bridge,fulfillment,valueGuide]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-native-v208.css'),
  read('public/app/fellowfare-native-scroll-v208.js'),
  read('public/app/fellowfare-cabinet-v144.js'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2-value-guide.js')
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
assert(bridge.includes('const BRIDGE_PEER=NATIVE?window:parent;'),'native FellowFare must keep its compatibility message bus inside the realm document when the persistent shell is the outer parent');
assert(bridge.includes('event.source!==BRIDGE_PEER'),'cabinet commands must validate against the native bridge peer instead of the outer persistent shell');
assert(bridge.includes("BRIDGE_PEER.postMessage({type:'fellowfare:cabinet-ready'"),'native FellowFare must deliver its ready signal back to the in-document cabinet controller');
assert(fulfillment.includes("SELF_MUTATION_SELECTOR='#ffFulfillmentDaily,#ffDirectMerchant,.ffv2-money-panel,.ffv2-policy-note'"),'fulfillment self-mutation guard missing');
new Function(bridge);
new Function(valueGuide);
assert(!/new MutationObserver\(enhance\)\.observe\([^;]+\{childList:true,subtree:true\}\)/.test(valueGuide),'value guide must not watch the entire marketplace subtree; its own decoration writes can create a main-thread feedback loop');
assert(valueGuide.includes("const renderRoot=document.querySelector('#main')||document.body;new MutationObserver(enhance).observe(renderRoot,{childList:true})"),'value guide must observe only route-level child replacement on the canonical render root');
assert(valueGuide.includes('if(box.innerHTML!==markup)box.innerHTML=markup'),'value-guide composer decoration must be idempotent');
console.log('FellowFare native v208 verification passed: one root owns scroll, the native compatibility bus stays inside the realm document under the persistent shell, value-guide decoration cannot feed its own observer, legacy nested-scroll writes are corrected, native contrast is explicit, and the marketplace remains iframe-free.');

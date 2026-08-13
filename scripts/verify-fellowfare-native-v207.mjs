import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const [html,css,host,bridge,fulfillment,contrast]=await Promise.all([
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/fellowfare-native-v207.css'),
  read('public/app/fellowfare-native-host-v207.js'),
  read('public/app/services/fellowfare/cabinet-bridge.js'),
  read('public/app/services/fellowfare/fulfillment-economy-v2.js'),
  read('public/app/services/fellowfare/marketplace-v2-contrast.css')
]);
assert(html.includes('data-build="fellowfare-native-market-v207"'),'native FellowFare build marker missing');
assert(html.includes('data-fellowfare-native-host="v207"'),'native host missing');
assert(!html.includes('<iframe id="ffc144-workbench"'),'nested marketplace iframe still active');
assert(!html.includes('<script src="/app/fellowfare-mobile-flow-v205.js'),'cross-document height observer still active');
for(const token of ['/app/services/fellowfare/marketplace-v2.js?v=native-v207','/app/services/fellowfare/fulfillment-economy-v2.js?v=native-v207','/app/services/fellowfare/cabinet-bridge.js?v=native-v207','/app/fellowfare-native-host-v207.js?v=native-v207'])assert(html.includes(token),`native surface missing ${token}`);
for(const token of ['height:auto!important','overflow:visible!important','.ffv2-trust-empty h2','.ffv2-profile-card small','.ff-fulfillment-quest-grid article'])assert(css.includes(token),`native page CSS missing ${token}`);
assert(host.includes('value:window')&&host.includes('iframe:false'),'native compatibility bridge does not stay in one browsing context');
assert(bridge.includes("const NATIVE=Boolean(document.querySelector('[data-fellowfare-native-host]'))"),'cabinet bridge is not native-aware');
assert(fulfillment.includes("SELF_MUTATION_SELECTOR='#ffFulfillmentDaily,#ffDirectMerchant,.ffv2-money-panel,.ffv2-policy-note'"),'fulfillment observer does not suppress its own render mutations');
assert(!fulfillment.includes('const observer=new MutationObserver(()=>requestAnimationFrame(enhance));'),'old self-triggering fulfillment observer remains');
assert(contrast.includes('r4 profile + fulfillment parchment contrast'),'upgrade-safe profile/fulfillment contrast missing');
console.log('FellowFare native v207 verification passed: one page owns scrolling, the iframe/height observer is retired, fulfillment rendering is loop-safe, and parchment contrast is explicit.');

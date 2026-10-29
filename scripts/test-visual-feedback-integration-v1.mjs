import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const common='/app/shared/guide-outcome-scene-v1';
const entries=[
  ['persistent-system-shell-v1.html','/app/shared-review-surface-v234.js'],
  ['working-campus-v440.html','/app/working-campus-v156.js'],
  ['realm-console-v140.html','/app/cerbanimo-quest-engine-v144.js'],
  ['cabinets/living-school/index.html',null],
  ['fellowfare-cabinet-v144.html','/app/services/fellowfare/marketplace-v2.js'],
  ['anarchadia-console-v139.html','/app/anarchadia-console-v158.js'],
  ['services/fellowfare/cabinet.html','marketplace-v2.js']
];
for(const [file,capability] of entries){
  test(`${file} declares one common outcome presenter before its capability startup`,()=>{
    const html=read(`public/app/${file}`),dom=new JSDOM(html),doc=dom.window.document;
    try{
      const scripts=[...doc.querySelectorAll('script[src]')],helpers=scripts.filter(node=>node.getAttribute('src').startsWith(`${common}.js`)),styles=[...doc.querySelectorAll('link[rel="stylesheet"]')].filter(node=>node.getAttribute('href').startsWith(`${common}.css`));
      assert.equal(helpers.length,1);assert.equal(styles.length,1);assert.equal(helpers[0].defer,true);
      for(const node of [...helpers,...styles])assert.equal(new URL(node.getAttribute(node.tagName==='SCRIPT'?'src':'href'),'https://civweave.test').searchParams.get('v'),'1.2.0-new-guide-atlases');
      if(capability){const target=scripts.find(node=>node.getAttribute('src').startsWith(capability));assert.ok(target);assert.ok(scripts.indexOf(helpers[0])<scripts.indexOf(target))}
      else assert.ok(html.indexOf(`${common}.js`)<html.indexOf("await import('/app/cabinets/living-school/living-school-cleanroom-v218.mjs"));
      if(file==='services/fellowfare/cabinet.html')for(const node of scripts.filter(node=>node.type!=='module'))assert.equal(node.defer,true,'standalone capability execution stays behind the ordered deferred presenter');
    }finally{dom.window.close()}
  });
}

test('the static shell includes common feedback assets without making animation a navigation prerequisite',()=>{
  const context={REQUIRED_SHELL_ASSETS:[],OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],self:{}};vm.runInNewContext(read('public/service-worker-shell-assets-v1.js'),context);
  for(const extension of ['js','css']){const asset=`${common}.${extension}`;assert.ok(context.OPTIONAL_SHELL_ASSETS.includes(asset));assert.ok(context.SHELL_ASSETS.includes(asset));assert.equal(context.REQUIRED_SHELL_ASSETS.includes(asset),false)}
  assert.ok(context.OPTIONAL_SHELL_ASSETS.includes('/app/assets/ai/kamiya-review-sprites-v1.png'));
  const revision=context.self.CivweaveShellAssetsV1.revision;assert.equal(revision,'shell-assets-v1-repair-v34-primary-quest-map');assert.ok(read('scripts/build-service-worker-v211.mjs').includes(`/service-worker-shell-assets-v1.js?v=${revision}`));
});

test('active capability pins select the implemented visual-workflow revisions',()=>{
  const expected={
    'public/app/anarchadia-console-v139.html':['anarchadia-console-v158.js?v=1.0.10-civic-work-map','anarchadia-change-review-v165.js?v=1.0.6-receipt-outcome','anarchadia-runtime-stability-v159.js?v=1.0.10-governance-tabs','anarchadia-console-v139.css?v=interior-r6-civic-work-map'],
    'public/app/anarchadia-governance-v145.html':['anarchadia-governance-v145.js?v=native-tabs-r2'],
    'public/app/persistent-system-shell-v1.html':['persistent-system-shell-v1.js?v=1.1.21-guild-quest-map-route','shared-review-surface-v234.js?v=1.0.6-map-first-review'],
    'public/app/working-campus-v440.html':['shared-review-surface-v234.js?v=1.0.6-map-first-review'],
    'public/app/realm-console-v140.html':['cerbanimo-quest-engine-v144.js?v=quest-engine-r37-shared-outcome-scene','cerbanimo-quest-engine-v144.css?v=quest-engine-r37-shared-outcome-scene','cw-reward-ledger-v2.js?v=2.1.1-persisted-grants'],
    'public/app/cabinets/living-school/index.html':['living-school-cleanroom-v218.mjs?v=structured-single-v221-exact-quest-map-selection','living-school-cleanroom-v218.css?v=journey-receipts-v2','cw-reward-ledger-v2.js?v=2.1.1-persisted-grants'],
    'public/app/cabinets/living-school/living-school-cleanroom-v218.mjs':['living-school-cleanroom-render-v218.mjs?v=quiz-journey-receipts-v2'],
    'public/app/fellowfare-cabinet-v144.html':['marketplace-v2.js?v=2.1.0-visual-workflow','marketplace-v2-capabilities.js?v=1.0.2-stable-order-target-visual-workflow','marketplace-v2.css?v=visual-workflow-v1','cw-reward-ledger-v2.js?v=2.1.1-persisted-grants'],
    'public/app/install-boundary-v146.js':["'/app/shared-review-surface-v234.js':'1.0.6-map-first-review'","[CANONICAL_REWARD_LEDGER]:'2.1.1-persisted-grants'"]
  };
  for(const [file,pins] of Object.entries(expected)){const source=read(file);for(const pin of pins)assert.ok(source.includes(pin),`${file} must load ${pin}`)}
  for(const file of ['cerbanimo-chat-quest-capability-v2.js','cerbanimo-chat-quest-capability-v3.js','lud-human-tools-v1.js'])assert.ok(read(`public/app/${file}`).includes('quest-engine-r37-shared-outcome-scene'));
});

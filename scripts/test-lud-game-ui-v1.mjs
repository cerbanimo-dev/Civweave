import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Lud surfaces use the shared lightweight game UI with inline critical styling',async()=>{
  const [download,campus,manifestText]=await Promise.all([
    read('public/app/lud/index.html'),
    read('public/app/lud/campus.html'),
    read('public/app/lud-package-v1.json'),
  ]);
  const manifest=JSON.parse(manifestText);
  for(const html of [download,campus]){
    assert.match(html,/data-lud-ui="game-v1"/);
    assert.match(html,/data-lud-critical-ui="game-v1"/);
    assert.match(html,/--cyan:#5ce5ff/);
    assert.match(html,/linear-gradient/);
    assert.match(html,/href="\/app\/lud-game-ui-v1\.css"/);
    assert.match(html,/src="\/app\/lud-game-ui-v1\.js"/);
  }
  assert.ok(manifest.assets.includes('/app/lud-game-ui-v1.css'));
  assert.ok(manifest.assets.includes('/app/lud-game-ui-v1.js'));
  assert.ok(manifest.assets.includes('/app/quest-arc-chronicle-v1.js'));
  assert.ok(manifest.assets.includes('/app/cerbanimo-intention-landscape-v1.css'));
  assert.ok(manifest.assets.includes('/app/cerbanimo-intention-landscape-v1.js'));
});

test('Lud campus exposes the canonical Guild Quest carousel alongside its human-powered HUD and Chronicle',async()=>{
  const campus=await read('public/app/lud/campus.html');
  assert.match(campus,/class="lud-hud"/);
  assert.match(campus,/id="lud-hud-passport"/);
  assert.match(campus,/id="lud-hud-guild"/);
  assert.match(campus,/id="lud-hud-beat"/);
  assert.match(campus,/id="lud-beat-history"/);
  assert.match(campus,/quest-arc-chronicle-v1\.js/);
  assert.match(campus,/id="rc-app" class="lud-quest-tracker-host"/);
  assert.match(campus,/class="rc-shell"/);
  assert.match(campus,/href="\/app\/cerbanimo-intention-landscape-v1\.css"/);
  assert.match(campus,/src="\/app\/cerbanimo-intention-landscape-v1\.js"/);
  assert.match(campus,/Questboard · Human creation/);
  assert.match(campus,/Quest Chronicle · Your human work/);
  assert.match(campus,/Guild Gate · Passport/);
  assert.match(campus,/Proof arena · Human validation/);
  assert.match(campus,/Market caravan · FellowFare human-only/);
  assert.match(campus,/host-node-installer-lobby-v1\.js/);
  assert.match(campus,/lud-manual-authoring-v1\.js/);
});

test('Lud game CSS is colorful, responsive, reduced-motion aware, and contains no visual asset URLs',async()=>{
  const css=await read('public/app/lud-game-ui-v1.css');
  assert.match(css,/--lud-cyan:#5ce5ff/);
  assert.match(css,/--lud-gold:#ffd45f/);
  assert.match(css,/--lud-coral:#ff718f/);
  assert.match(css,/--lud-violet:#bc91ff/);
  assert.match(css,/linear-gradient/);
  assert.match(css,/radial-gradient/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.cw-host-node-lobby/);
  assert.doesNotMatch(css,/\burl\s*\(/i);
  assert.doesNotMatch(css,/background-image\s*:/i);
});

test('Lud game JS is presentation-only and reads canonical Passport, Guild, and Quest Arc status',async()=>{
  const source=await read('public/app/lud-game-ui-v1.js');
  assert.match(source,/CivweavePassportIdentityV1/);
  assert.match(source,/CivweaveHostNodeSessionV1/);
  assert.match(source,/CivweaveQuestArcChronicleV1/);
  assert.match(source,/historyProjections/);
  assert.match(source,/publicStatus/);
  assert.match(source,/civweave:capacity-session-ready/);
  assert.match(source,/civweave:passport-ready/);
  assert.match(source,/civweave:quest-arc-changed/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/setInterval\s*\(/);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/\.generate\s*\(/);
});

test('Lud package worker rejects stale ready metadata after a package generation bump and permits the live Guild directory',async()=>{
  const [installer,worker]=await Promise.all([
    read('public/app/lud-installer-v1.js'),
    read('public/service-worker-lud-package-v1.js'),
  ]);
  assert.match(installer,/VERSION='1\.0\.5'/);
  assert.match(installer,/service-worker-lud-package-v1\.js\?v=1\.0\.5/);
  assert.match(worker,/LUD_REVISION='lud-package-v1\.4-quest-tracker'/);
  assert.match(worker,/['"]\/api\/hub-map-nodes['"]/);
  assert.match(worker,/if\(meta\?\.revision===LUD_REVISION\)return ludPacket\(meta\)/);
  assert.match(worker,/meta\?\.revision===LUD_REVISION&&Array\.isArray/);
});

test('Lud package refreshes allowlisted assets online before using its offline cache',async()=>{
  const worker=await read('public/service-worker-lud-package-v1.js');
  const entryStart=worker.indexOf("if(pathname===policy.entryRoute");
  const entryEnd=worker.indexOf("if(pathname.startsWith('/app/lud/'))",entryStart);
  const entryBlock=worker.slice(entryStart,entryEnd);
  assert.ok(entryStart>=0&&entryEnd>entryStart);
  assert.ok(entryBlock.indexOf('const network=await fetchLudEntry()')>=0);
  assert.ok(entryBlock.indexOf('const network=await fetchLudEntry()')<entryBlock.indexOf('const cached=await cache.match'));
  assert.match(entryBlock,/cache\.put\(ludKey\(policy\.entry\|\|LUD_ENTRY_ASSET\),network\.clone\(\)\)/);

  const assetStart=worker.indexOf('if(policy.assets.has(pathname))');
  const assetEnd=worker.indexOf('if(LUD_INSTALLER_PATHS.has(pathname))',assetStart);
  const assetBlock=worker.slice(assetStart,assetEnd);
  assert.ok(assetStart>=0&&assetEnd>assetStart);
  assert.ok(assetBlock.indexOf('const response=await fetch(request)')>=0);
  assert.ok(assetBlock.indexOf('const response=await fetch(request)')<assetBlock.indexOf('const cached=await cache.match'));
  assert.match(assetBlock,/cache\.put\(ludKey\(pathname\),response\.clone\(\)\)/);
});

test('Lud custom forms expose static starter templates without adding AI generation',async()=>{
  const source=await read('public/app/lud-manual-authoring-v1.js');
  assert.match(source,/VERSION='1\.3\.0-templates'/);
  assert.match(source,/const TEMPLATES=Object\.freeze/);
  for(const kind of ['quest','task','learning-module','learning-program','resource-manifest','skill-manifest'])assert.match(source,new RegExp(`['\"]?${kind.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['\"]?\\s*:`));
  assert.match(source,/Jumpstart with a template/);
  assert.match(source,/data-apply-template/);
  assert.match(source,/function applyTemplate\(/);
  assert.match(source,/Static human-authored starters only/);
  assert.match(source,/civweave:lud-template-applied/);
  assert.doesNotMatch(source,/\.generate\s*\(/);
});

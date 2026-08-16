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
});

test('Lud campus exposes game-like HUD and human-powered labels without changing capability owners',async()=>{
  const campus=await read('public/app/lud/campus.html');
  assert.match(campus,/class="lud-hud"/);
  assert.match(campus,/id="lud-hud-passport"/);
  assert.match(campus,/id="lud-hud-guild"/);
  assert.match(campus,/Questboard · Human creation/);
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

test('Lud game JS is presentation-only and reads canonical Passport and Guild status',async()=>{
  const source=await read('public/app/lud-game-ui-v1.js');
  assert.match(source,/CivweavePassportIdentityV1/);
  assert.match(source,/CivweaveHostNodeSessionV1/);
  assert.match(source,/publicStatus/);
  assert.match(source,/civweave:capacity-session-ready/);
  assert.match(source,/civweave:passport-ready/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/setInterval\s*\(/);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/\.generate\s*\(/);
});

test('Lud package worker rejects stale ready metadata after a presentation generation bump',async()=>{
  const [installer,worker]=await Promise.all([
    read('public/app/lud-installer-v1.js'),
    read('public/service-worker-lud-package-v1.js'),
  ]);
  assert.match(installer,/VERSION='1\.0\.3'/);
  assert.match(installer,/service-worker-lud-package-v1\.js\?v=1\.0\.3/);
  assert.match(worker,/LUD_REVISION='lud-package-v1\.1-game-ui'/);
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

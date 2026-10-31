import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Guild session v1.0.138 is loaded consistently across current local-capacity and guide integrations',()=>{
  const session=read('public/app/host-node-session-v1.js');
  const local=read('public/app/host-node-local-capacity-v1.js');
  const strip=read('public/app/minilm-decision-strip-v1.js');
  const starling=read('public/app/starling-integration-v1.js');
  const finder=read('public/app/host-node-installer-lobby-v1.js');
  const overlay=read('public/app/guild-symbol-v1.js');
  const campus=read('public/app/working-campus-v440.html');
  assert.match(session,/1\.0\.138-host-node-session-v7-unified-guild-access/);
  assert.match(local,/SESSION_RUNTIME_VERSION = '1\.0\.138-'/);
  for(const src of [local,strip,starling])
    assert.match(src,/host-node-session-v1\.js\?v=1\.0\.138-unified-guild-access/);
  assert.match(finder,/function inspectOrigin/);
  assert.match(overlay,/v=unified-guild-access-v1/);
  assert.match(campus,/guild-tab-unified-access-v1/);
  assert.match(session,/function isSignedOut/);
  assert.match(session,/function reconnectLegacyGuildkeeper/);
  assert.match(session,/function deselectGuild/);
});

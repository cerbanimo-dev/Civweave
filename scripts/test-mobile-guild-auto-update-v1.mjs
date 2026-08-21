import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const repoRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const templateRoot=join(repoRoot,'cloudflare/mobile-guild-edge');
const config=JSON.parse(readFileSync(join(templateRoot,'civweave-update.json'),'utf8'));
const workflow=readFileSync(join(templateRoot,'.github/workflows/civweave-auto-update.yml'),'utf8');
const updater=readFileSync(join(templateRoot,'.civweave/sync-upstream.mjs'),'utf8');

assert.equal(config.schema,'civweave.guild-cloud-auto-update.v1');
assert.equal(config.sourceRepository,'cerbanimo-dev/Civweave');
assert.equal(config.sourcePath,'cloudflare/mobile-guild-edge');
assert.ok(['main','staging'].includes(config.channel),`Unexpected Civweave Guild Cloud update channel: ${config.channel}`);
assert.equal(config.checkIntervalHours,6);
assert.equal(config.schedulerHeartbeatDays,30);
for(const path of ['src','.civweave','.github/workflows/civweave-auto-update.yml','package.json','civweave-update.json'])assert.ok(config.managedPaths.includes(path),`Managed update path missing: ${path}`);
for(const key of ['main','compatibility_date','ai','durable_objects','migrations'])assert.ok(config.wranglerManagedKeys.includes(key),`Managed Wrangler key missing: ${key}`);
for(const key of ['name','account_id','workers_dev','routes','route'])assert.ok(config.wranglerPreservedKeys.includes(key),`Preserved Wrangler key missing: ${key}`);

assert.match(workflow,/schedule:/);
assert.match(workflow,/cron:\s*'23 \*\/6 \* \* \*'/);
assert.match(workflow,/contents:\s*write/);
assert.match(workflow,/git clone[^\n]+--sparse/);
assert.match(workflow,/rev-parse \"HEAD:\$\{SOURCE_PATH\}\"/);
assert.match(workflow,/sync-upstream\.mjs/);
assert.match(workflow,/schedulerHeartbeatDays/);
assert.match(workflow,/civweave-update-heartbeat\.json/);
assert.match(workflow,/git push/);
assert.doesNotMatch(workflow,/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow,/wrangler\s+deploy/);
assert.match(updater,/wranglerManagedKeys/);
assert.match(updater,/wranglerPreservedKeys/);
assert.match(updater,/civweave-update-lock\.json/);
assert.match(updater,/civweave-update-heartbeat\.json/);

const scratch=mkdtempSync(join(tmpdir(),'civweave-guild-auto-update-'));
try{
  const guildRepo=join(scratch,'guild');
  cpSync(templateRoot,guildRepo,{recursive:true});
  const wranglerPath=join(guildRepo,'wrangler.jsonc');
  const wrangler=JSON.parse(readFileSync(wranglerPath,'utf8'));
  wrangler.name='kamido-guild-cloud';
  wrangler.account_id='guildkeeper-account';
  wrangler.workers_dev=false;
  wrangler.routes=[{pattern:'guild.example.test/*',zone_name:'example.test'}];
  wrangler.vars={...(wrangler.vars||{}),CIVWEAVE_NODE_CLOUD_DOMAIN:'guildkeeper.example.test'};
  wrangler.compatibility_date='2020-01-01';
  writeFileSync(wranglerPath,`${JSON.stringify(wrangler,null,2)}\n`);

  execFileSync(process.execPath,[join(guildRepo,'.civweave/sync-upstream.mjs'),'--source',templateRoot,'--commit','deadbeef','--tree','feedface'],{cwd:guildRepo,stdio:'pipe'});
  const merged=JSON.parse(readFileSync(wranglerPath,'utf8'));
  const canonical=JSON.parse(readFileSync(join(templateRoot,'wrangler.jsonc'),'utf8'));
  const lock=JSON.parse(readFileSync(join(guildRepo,'civweave-update-lock.json'),'utf8'));
  const heartbeat=JSON.parse(readFileSync(join(guildRepo,'civweave-update-heartbeat.json'),'utf8'));

  assert.equal(merged.name,'kamido-guild-cloud');
  assert.equal(merged.account_id,'guildkeeper-account');
  assert.equal(merged.workers_dev,false);
  assert.deepEqual(merged.routes,[{pattern:'guild.example.test/*',zone_name:'example.test'}]);
  assert.equal(merged.vars.CIVWEAVE_NODE_CLOUD_DOMAIN,'guildkeeper.example.test');
  assert.equal(merged.compatibility_date,canonical.compatibility_date);
  assert.deepEqual(merged.durable_objects,canonical.durable_objects);
  assert.deepEqual(merged.migrations,canonical.migrations);
  assert.equal(lock.schema,'civweave.guild-cloud-auto-update-lock.v1');
  assert.equal(lock.channel,config.channel);
  assert.equal(lock.upstreamCommit,'deadbeef');
  assert.equal(lock.upstreamTree,'feedface');
  assert.equal(heartbeat.schema,'civweave.guild-cloud-auto-update-heartbeat.v1');
  assert.equal(heartbeat.channel,config.channel);
  assert.equal(heartbeat.upstreamTree,'feedface');
  assert.equal(heartbeat.checkedAt,lock.appliedAt);
}finally{rmSync(scratch,{recursive:true,force:true});}

console.log(JSON.stringify({ok:true,schema:'civweave.mobile-guild-auto-update.test.v1',channel:config.channel,intervalHours:config.checkIntervalHours,heartbeatDays:config.schedulerHeartbeatDays,preservesGuildkeeperDeployment:true,requiresManualCloudflareUpdate:false}));

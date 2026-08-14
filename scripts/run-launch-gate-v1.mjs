import { spawnSync } from 'node:child_process';

const strictPublic = process.argv.includes('--public');
const quick = process.argv.includes('--quick');
const commands = [
  ['node',['--check','cloudflare/node-cloud/src/server-ai-entry-v2.mjs']],
  ['node',['--check','cloudflare/node-cloud/src/capacity-user-pools-v2.mjs']],
  ['node',['--check','cloudflare/account-edge/src/index.mjs']],
  ['node',['scripts/test-user-ai-pool-routing-v2.mjs']],
  ['node',['scripts/verify-user-ai-pools-v302.mjs']],
  ['node',['scripts/verify-pwa-cold-launch-recovery-v426.mjs']],
  ['node',['scripts/verify-local-ai-smooth-fit-v314.mjs']],
  ['python3',['scripts/civweave_d1_backup.py','--help']],
  ['npm',['run','check:release-discipline']],
];
if (!quick) {
  commands.push(['npm',['run','check']]);
  commands.push(['npm',['run','audit:production']]);
}
commands.push(['node',['scripts/verify-public-launch-readiness-v1.mjs',...(strictPublic?['--public']:[])]]);
for (const [command,args] of commands) {
  console.log(`\n>>> ${command} ${args.join(' ')}`);
  const result = spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`\nLaunch gate passed${strictPublic?' for public promotion':' for code readiness'}.`);

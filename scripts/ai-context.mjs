#!/usr/bin/env node
import { buildPacket, readRegistry, validateRegistry } from './lib/ai-context-resolver.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : (process.argv[index + 1] || '');
}
try {
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify({ results: [validateRegistry('dev'), validateRegistry('runtime')] }, null, 2));
  } else if (process.argv.includes('--list')) {
    console.log(JSON.stringify({
      developer: readRegistry('dev').workspaces.map(x => ({ id: x.id, stages: x.stages.map(s => s.id) })),
      runtimePilots: readRegistry('runtime').workflows.map(x => ({ id: x.id, stages: x.stages.map(s => s.id), active: false })),
    }, null, 2));
  } else {
    const dev = option('--workspace');
    const pack = option('--pack');
    const stage = option('--stage');
    if ((!dev && !pack) || (dev && pack) || !stage) {
      throw new Error('Usage: --check | --list | --workspace <id> --stage <id> | --pack <id> --stage <id>');
    }
    console.log(JSON.stringify(buildPacket(dev ? 'dev' : 'runtime', dev || pack, stage), null, 2));
  }
} catch (error) {
  console.error('[ai-context] ' + error.message);
  process.exitCode = 1;
}

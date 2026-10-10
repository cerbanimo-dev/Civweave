import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPacket, readRegistry, safeRepoPath, validateRegistry } from './lib/ai-context-resolver.mjs';

test('developer and runtime registries validate without fetching the network', () => {
  assert.equal(validateRegistry('dev').count, 2);
  assert.equal(validateRegistry('runtime').count, 1);
});
test('repository context paths cannot traverse or escape via absolute references', () => {
  for (const bad of ['../../etc/passwd', '/etc/passwd', 'docs//contracts/a', 'https://example.com/a', './AGENTS.md', 'docs/../AGENTS.md']) {
    assert.throws(() => safeRepoPath(bad), undefined, bad);
  }
  assert.match(safeRepoPath('AGENTS.md'), /AGENTS\.md$/);
});
test('stage packet is deterministic and carries independent authority references', () => {
  const a = buildPacket('dev', 'bug-fix', 'trace-owner');
  const b = buildPacket('dev', 'bug-fix', 'trace-owner');
  assert.deepEqual(a, b);
  assert.equal(a.nextStage, 'test-first');
  assert.ok(a.authorityFiles.includes('config/system-ownership.json'));
  assert.ok(a.instructions.includes('## Acceptance'));
});
test('Moss stages are explicitly disabled until the canonical owner integrates them', () => {
  const p = buildPacket('runtime', 'learning-journey', 'design');
  assert.equal(p.runtimeEnabled, false);
  assert.deepEqual(p.expectedOutputs, ['learning-design.md', 'assessment-plan.json']);
  assert.equal(p.nextStage, 'compile');
});
test('invalid registry states fail closed', () => {
  const broken = structuredClone(readRegistry('runtime'));
  broken.runtimeEnabled = true;
  assert.throws(() => validateRegistry('runtime', broken), /may not be enabled/);
  const duplicate = structuredClone(readRegistry('dev'));
  duplicate.workspaces[0].stages[1].id = duplicate.workspaces[0].stages[0].id;
  assert.throws(() => validateRegistry('dev', duplicate), /Duplicate ID/);
  const missing = structuredClone(readRegistry('dev'));
  missing.workspaces[0].stages[0].context = 'docs/agent-workspaces/unknown/CONTEXT.md';
  assert.throws(() => validateRegistry('dev', missing));
});

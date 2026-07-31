import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, syntheticFixture, classifyProposal, validateProposal, validateBridge,
  mergeImportedState, readinessSummary, makeHumanApprovalMarkdown
} from '../src/domain.js';

test('empty workspace contains no authority claims and starts blocked', () => {
  const state = emptyState({ communityName: 'Test Commons', mode: 'synthetic' });
  assert.equal(state.meta.communityName, 'Test Commons');
  assert.match(state.meta.authorityDisclaimer, /does not certify/i);
  assert.equal(readinessSummary(state).pilotStatus, 'blocked or synthetic-only');
});

test('rights-critical language is surfaced but not certified', () => {
  const result = classifyProposal({ title: 'Housing eligibility and exclusion rule' });
  assert.equal(result.level, 'rights-critical');
  assert.ok(result.matched.includes('housing'));
  assert.ok(result.matched.includes('eligibility'));
});

test('proposal validation requires bounded procedural fields', () => {
  const result = validateProposal({ title: 'A', purpose: 'B' });
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes('affectedPeople'));
  assert.equal(result.executable, false);
});

test('bridge remains default-off and rejects prohibited identity fields', () => {
  const result = validateBridge({
    direction: 'A to B', purpose: 'test', recipientClass: 'stewards', fields: 'account identity',
    retention: 'one day', expiry: 'one day', revocation: 'manual', failureClosed: 'stop',
    reidentificationRisk: 'high', manualAlternative: 'paper', enabled: false
  });
  assert.equal(result.valid, false);
  assert.ok(result.flagged.includes('identity'));
});

test('import preserves divergent records as contested instead of overwriting', () => {
  const local = syntheticFixture();
  const incoming = structuredClone(local);
  incoming.charter.sections[0].text = 'Conflicting imported text';
  const { merged, conflicts } = mergeImportedState(local, incoming);
  assert.ok(conflicts.some(conflict => conflict.collection === 'charter'));
  assert.equal(merged.charter.sections[0].text, local.charter.sections[0].text);
  assert.equal(merged.charter.conflicts.at(-1).status, 'contested');
});

test('human approval file says it is a procedural gate only', () => {
  const state = emptyState({ communityName: 'Test Commons' });
  const markdown = makeHumanApprovalMarkdown({ reviewingPeople: 'Review circle' }, state.meta);
  assert.match(markdown, /procedural gate only/i);
  assert.match(markdown, /does not certify/i);
});

test('imported improvement records merge by id and preserve divergent bugs as conflicts', () => {
  const local = syntheticFixture();
  local.improvementSystem = {
    bugs: [{ id: 'bug_shared', title: 'Local wording', status: 'triage' }],
    forgeDrafts: [],
    railChecks: []
  };
  const incoming = structuredClone(local);
  incoming.meta.communityRef = 'community_remote';
  incoming.improvementSystem.bugs = [
    { id: 'bug_shared', title: 'Remote wording', status: 'triage' },
    { id: 'bug_new', title: 'Portable new bug', status: 'triage' }
  ];
  const { merged, conflicts } = mergeImportedState(local, incoming);
  assert.ok(conflicts.some(conflict => conflict.collection === 'improvementSystem.bugs'));
  assert.ok(merged.improvementSystem.bugs.some(item => item.id === 'bug_new'));
  assert.equal(merged.improvementSystem.bugs.find(item => item.id === 'bug_shared').title, 'Local wording');
});


test('new civic operations exist in empty and synthetic state', () => {
  const empty = emptyState({ communityName: 'Civic Test' });
  for (const key of ['petitionSignals','discussions','workgroups','bulletins','federationMessages','adoptionSignals','experiments','rollbacks','dismissedAlerts']) {
    assert.ok(Array.isArray(empty.civicSystem[key]), key);
  }
  const fixture = syntheticFixture();
  assert.ok(fixture.civicSystem.workgroups.length > 0);
  assert.ok(fixture.civicSystem.bulletins.length > 0);
  assert.ok(fixture.civicSystem.experiments.length > 0);
});

test('import preserves divergent civic records as contested', () => {
  const local = syntheticFixture();
  const incoming = structuredClone(local);
  incoming.civicSystem.workgroups[0].purpose = 'Conflicting remote purpose';
  incoming.civicSystem.workgroups.push({ id: 'workgroup_new', name: 'Portable group', purpose: 'New', status: 'forming' });
  const { merged, conflicts } = mergeImportedState(local, incoming);
  assert.ok(conflicts.some(conflict => conflict.collection === 'civicSystem.workgroups'));
  assert.ok(merged.civicSystem.workgroups.some(item => item.id === 'workgroup_new'));
});

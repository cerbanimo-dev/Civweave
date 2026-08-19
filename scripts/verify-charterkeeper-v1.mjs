import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHARTERKEEPER_POLICY,
  CHARTERKEEPER_TRAINING_MODULES,
  splitCerbanimoForCharterkeeper
} from '../cloudflare/core/src/charterkeeper-v1.mjs';

assert.deepEqual(splitCerbanimoForCharterkeeper(250), {
  existingCerbanimoShareCents: 250,
  charterkeeperShareCents: 125,
  cerbanimoRemainingCents: 125,
  charterkeeperShareBps: 5000
});
assert.deepEqual(splitCerbanimoForCharterkeeper(251), {
  existingCerbanimoShareCents: 251,
  charterkeeperShareCents: 125,
  cerbanimoRemainingCents: 126,
  charterkeeperShareBps: 5000
});
assert.equal(splitCerbanimoForCharterkeeper(0).charterkeeperShareCents, 0);
assert.equal(CHARTERKEEPER_POLICY.relationshipDepth, 1);
assert.equal(CHARTERKEEPER_POLICY.recursiveAncestorShares, false);
assert.equal(CHARTERKEEPER_POLICY.multipleChildGuildsAllowed, true);
assert.equal(CHARTERKEEPER_POLICY.oneActiveCharterkeeperPerChildGuild, true);
assert.equal(CHARTERKEEPER_POLICY.hostGuildkeeperShareInvariant, true);
assert.equal(CHARTERKEEPER_POLICY.systemReserveInvariant, true);
assert.equal(CHARTERKEEPER_POLICY.memberPriceInvariant, true);
assert.equal(CHARTERKEEPER_TRAINING_MODULES.length, 5);
assert.deepEqual(CHARTERKEEPER_TRAINING_MODULES.map(item => item.id), [
  'guild-purpose-and-charter',
  'member-safety-and-governance',
  'capacity-and-costs',
  'payments-and-compliance',
  'handoff-readiness'
]);

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('cloudflare/core/migrations/0012_charterkeepers.sql');
const guards = read('cloudflare/core/migrations/0013_charterkeeper_guards.sql');
const charterEntry = read('cloudflare/core/src/charterkeeper-entry-v1.mjs');
const composition = read('cloudflare/core/src/territory-stewardship-with-charterkeepers-v1.mjs');
const money = read('cloudflare/core/src/money-edge-with-memberships.mjs');
const origin = read('cloudflare/core/src/origin-entry.mjs');
const proxy = read('lib/node-ai-live-commerce-v1.mjs');
const serverEntry = read('cloudflare/node-cloud/src/server-ai-entry-v6.mjs');
const stagingEntry = read('cloudflare/node-cloud/src/staging-entry-v1.mjs');
const operator = read('public/app/node-ai-operator-v1.html');
const ui = read('public/app/node-ai-charterkeeper-v1.js');
const mobile = read('public/app/mobile-guild-create-v1.mjs');

assert.match(migration, /founder-transfer/);
assert.match(migration, /mentor-direct/);
assert.match(migration, /nominee_appointment_confirmed/);
assert.match(migration, /money_edge_charters_one_active_child_idx/);
assert.match(migration, /WHERE child_node_id IS NOT NULL AND status='active'/);
assert.doesNotMatch(migration, /child_node_id TEXT UNIQUE/);
assert.match(migration, /UNIQUE\(source_kind,source_id\)/);
assert.match(guards, /charterkeeper_end_on_source_operator_transfer/);
assert.match(guards, /reserved-charter-inactive/);
assert.match(charterEntry, /nomineeAppointmentConfirmed !== true/);
assert.match(charterEntry, /nominee_appointment_confirmed=1/);
assert.match(composition, /settleCharterForMembership/);
assert.match(composition, /cerbanimoShareCents: remaining\(charterkeeper, row\.cerbanimo_share_cents\)/);
assert.match(composition, /retryPendingCharterkeeperShares/);
assert.match(money, /territory-stewardship-with-charterkeepers-v1\.mjs/);
assert.match(origin, /charterkeeper-entry-v1\.mjs/);
assert.match(proxy, /\/api\/ai\/node\/live\/operator\/charters/);
assert.match(proxy, /childNodeId: manifest\.nodeId/);
assert.match(serverEntry, /GUILDKEEPER_LOCAL_OPERATOR_ROUTE/);
assert.match(serverEntry, /authenticatedOperatorNode/);
assert.match(serverEntry, /capacity\.internal\/guildkeepers\/\$\{action\}/);
assert.match(stagingEntry, /charterkeeper-v1-signed-handoff/);
assert.match(operator, /id="charterkeeper"/);
assert.match(operator, /node-ai-charterkeeper-v1\.js/);
assert.match(ui, /Create, then hand off/);
assert.match(ui, /Nominate, train, they create it/);
assert.match(ui, /ensureNomineeAppointment/);
assert.match(ui, /must already be a member of this Guild/);
assert.match(ui, /Accept Charter & handoff/);
assert.match(mobile, /civweave\.guild-charter-provenance\.v1/);
assert.match(mobile, /charter:charterContext/);

console.log(JSON.stringify({
  ok: true,
  schema: 'civweave.charterkeeper.verify.v1',
  split: splitCerbanimoForCharterkeeper(250),
  trainingModules: CHARTERKEEPER_TRAINING_MODULES.length,
  appointedGuildkeeperGate: true,
  activeOnlyChildUniqueness: true,
  oneHop: true,
  recursiveAncestorShares: false,
  signedSourceAndChildRoutes: true,
  stagingGuildRebuildMarked: true,
  guildGenesisProvenance: true
}, null, 2));
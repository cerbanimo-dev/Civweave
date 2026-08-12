import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLocalHostCapacityStore } from '../lib/local-host-capacity-v1.mjs';

const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'civweave-local-host-capacity-'));
let clock = Date.parse('2026-08-12T22:00:00.000Z');
const now = () => (clock += 1_000);

try {
  const store = createLocalHostCapacityStore({ dataDir: root, nodeId: 'cw:test-node', communitySeatLimit: 2, paidExpansionSeatLimit: 1, now });

  let capacity = await store.snapshot();
  assert.deepEqual(capacity.slots, { free: 2, paid: 1 });
  assert.equal(capacity.counts.members, 0);

  const first = await store.admit({ residentId: 'cwres:resident-one', userId: 'passport:one', seatClass: 'community' });
  assert.equal(first.idempotent, false);
  assert.deepEqual(first.capacity.slots, { free: 1, paid: 1 });

  const duplicate = await store.admit({ residentId: 'cwres:resident-one', userId: 'passport:one', seatClass: 'community' });
  assert.equal(duplicate.idempotent, true);
  assert.deepEqual(duplicate.capacity.slots, { free: 1, paid: 1 });

  const paidCommunity = await store.applyPaymentEvent({ id: 'membership:invoice-one', type: 'membership.paid', userId: 'passport:one', tierId: 'member' });
  assert.equal(paidCommunity.member.seatClass, 'community');
  assert.equal(paidCommunity.member.billingStatus, 'paid');
  assert.deepEqual(paidCommunity.capacity.slots, { free: 1, paid: 1 }, 'a paid community resident must leave paid-expansion capacity open');
  assert.equal(paidCommunity.capacity.counts.activePaidMembers, 1);

  const paidExpansion = await store.applyPaymentEvent({ id: 'membership:invoice-two', type: 'membership.paid', userId: 'passport:two', tierId: 'maker' });
  assert.equal(paidExpansion.member.seatClass, 'paid-expansion');
  assert.deepEqual(paidExpansion.capacity.slots, { free: 1, paid: 0 });
  assert.equal(paidExpansion.capacity.counts.activePaidMembers, 2);

  const secondCommunity = await store.admit({ residentId: 'cwres:resident-three', userId: 'passport:three', seatClass: 'community' });
  assert.deepEqual(secondCommunity.capacity.slots, { free: 0, paid: 0 });

  await assert.rejects(
    () => store.admit({ residentId: 'cwres:resident-four', userId: 'passport:four', seatClass: 'community' }),
    error => error?.status === 409 && error?.message === 'community-capacity-full'
  );

  const ended = await store.applyPaymentEvent({ id: 'membership:end-two', type: 'membership.ended', userId: 'passport:two' });
  assert.equal(ended.member.billingStatus, 'grace');
  assert.equal(ended.capacity.counts.graceMembers, 1);
  assert.equal(ended.capacity.slots.paid, 0, 'paid-expansion residents keep their seat during grace');

  const reloaded = createLocalHostCapacityStore({ dataDir: root, nodeId: 'cw:test-node', communitySeatLimit: 2, paidExpansionSeatLimit: 1, now });
  capacity = await reloaded.snapshot();
  assert.deepEqual(capacity.slots, { free: 0, paid: 0 });
  assert.equal(capacity.counts.communityMembers, 2);
  assert.equal(capacity.counts.paidExpansionMembers, 1);
  assert.equal(capacity.counts.activePaidMembers, 1);
  assert.equal(capacity.counts.graceMembers, 1);

  console.log(JSON.stringify({ ok: true, schema: capacity.schema, slots: capacity.slots, counts: capacity.counts }, null, 2));
} finally {
  await fsp.rm(root, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { NodeAiLedger } from '../lib/node-ai-ledger-sqlite-v1.mjs';

const DEFAULTS = Object.freeze({ runs: 4, operations: 3000, nodes: 3, users: 6, seed: 'civweave-node-ai-chaos-v1' });
const START_MS = Date.parse('2026-08-09T00:00:00.000Z');
const SUMMARY_START = '2026-01-01T00:00:00.000Z';
const SUMMARY_END = '2035-01-01T00:00:00.000Z';
const TRACE_LIMIT = 60;

function parseArgs(argv) {
  const values = { ...DEFAULTS };
  for (const raw of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(raw);
    if (!match) throw new TypeError(`Unknown argument: ${raw}`);
    const [, key, value] = match;
    if (key === 'seed') values.seed = String(value || DEFAULTS.seed);
    else if (['runs', 'operations', 'nodes', 'users'].includes(key)) values[key] = Number(value);
    else throw new TypeError(`Unknown argument: --${key}`);
  }
  for (const [key, min, max] of [['runs',1,100],['operations',100,200000],['nodes',1,12],['users',1,50]]) {
    const value = values[key];
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${key} must be an integer from ${min} through ${max}.`);
  }
  return Object.freeze(values);
}

function seed32(value) {
  let hash = 2166136261 >>> 0;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 0x9e3779b9;
}

function rngFrom(seed) {
  let state = seed32(seed);
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
  return Object.freeze({
    float: next,
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    bool(probability = 0.5) { return next() < probability; },
    pick(values) { if (!values.length) return null; return values[Math.floor(next() * values.length)]; }
  });
}

const iso = ms => new Date(ms).toISOString();
const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
function modelUser(userId) { return { userId, walletExists: false, balance: 0, debt: 0, reservations: new Map() }; }
function reservationTotal(user) { return sum([...user.reservations.values()].map(row => row.max)); }
function available(user) { return Math.max(0, user.balance - reservationTotal(user)); }
function platformFee(gross, bps) { return Math.floor(gross * bps / 10_000); }
function differentUser(node, owner, rng) { const choices = [...node.users.values()].filter(user => user.userId !== owner); return rng.pick(choices) || node.users.get(owner); }
function pickMapValue(map, rng) { return rng.pick([...map.values()]); }
function compactNode(node) {
  return {
    nodeId: node.nodeId,
    platformFeeBps: node.platformFeeBps,
    sources: node.sources.size,
    reservations: node.reservationOwners.size,
    restarts: node.restarts,
    summary: node.summary,
    users: [...node.users.values()].map(user => ({ userId: user.userId, walletExists: user.walletExists, balance: user.balance, debt: user.debt, reserved: reservationTotal(user) }))
  };
}

function assertUser(node, user, context) {
  const wallet = node.ledger.getWallet(user.userId);
  if (!user.walletExists) {
    assert.equal(wallet, null, `${context}: wallet appeared for ${user.userId}`);
    return;
  }
  assert.ok(wallet, `${context}: wallet missing for ${user.userId}`);
  const reserved = reservationTotal(user);
  assert.equal(wallet.balanceCents, user.balance, `${context}: balance mismatch for ${user.userId}`);
  assert.equal(wallet.debtCents, user.debt, `${context}: debt mismatch for ${user.userId}`);
  assert.equal(wallet.reservedCents, reserved, `${context}: reserved mismatch for ${user.userId}`);
  assert.equal(wallet.availableCents, Math.max(0, user.balance - reserved), `${context}: available mismatch for ${user.userId}`);
  assert.ok(wallet.balanceCents >= 0, `${context}: negative balance for ${user.userId}`);
  assert.ok(wallet.debtCents >= 0, `${context}: negative debt for ${user.userId}`);
  assert.ok(wallet.reservedCents <= wallet.balanceCents, `${context}: reservations exceed backing balance for ${user.userId}`);
  if (wallet.debtCents > 0) assert.equal(wallet.availableCents, 0, `${context}: indebted wallet retained spendable credit for ${user.userId}`);
}

function assertNode(node, context, { deep = false } = {}) {
  for (const user of node.users.values()) assertUser(node, user, context);
  if (!deep) return;

  const wallets = node.ledger.db.prepare('SELECT user_id,balance_cents,debt_cents FROM node_ai_wallets WHERE node_id=? ORDER BY user_id').all(node.nodeId);
  const expectedWallets = [...node.users.values()].filter(user => user.walletExists).sort((a,b) => a.userId.localeCompare(b.userId));
  assert.equal(wallets.length, expectedWallets.length, `${context}: wallet row count mismatch`);
  wallets.forEach((row, index) => {
    const expected = expectedWallets[index];
    assert.equal(row.user_id, expected.userId, `${context}: wallet owner mismatch`);
    assert.equal(Number(row.balance_cents), expected.balance, `${context}: durable balance mismatch`);
    assert.equal(Number(row.debt_cents), expected.debt, `${context}: durable debt mismatch`);
  });

  const reservations = node.ledger.db.prepare('SELECT reservation_id,user_id,max_retail_cost_cents,expires_at FROM node_ai_reservations WHERE node_id=? ORDER BY reservation_id').all(node.nodeId);
  const expectedReservations = [...node.reservationOwners.values()].sort((a,b) => a.id.localeCompare(b.id));
  assert.equal(reservations.length, expectedReservations.length, `${context}: reservation row count mismatch`);
  reservations.forEach((row, index) => {
    const expected = expectedReservations[index];
    assert.equal(row.reservation_id, expected.id, `${context}: reservation id mismatch`);
    assert.equal(row.user_id, expected.userId, `${context}: reservation owner mismatch`);
    assert.equal(Number(row.max_retail_cost_cents), expected.max, `${context}: reservation amount mismatch`);
    assert.equal(Date.parse(row.expires_at), expected.expiresAtMs, `${context}: reservation expiry mismatch`);
  });

  const paymentCount = Number(node.ledger.db.prepare('SELECT COUNT(*) AS count FROM node_ai_payment_events WHERE node_id=?').get(node.nodeId)?.count || 0);
  assert.equal(paymentCount, node.sources.size, `${context}: payment event/source count mismatch`);

  const balanceLedger = Number(node.ledger.db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS total FROM node_ai_ledger WHERE node_id=? AND kind!='cerbanimo-platform-fee-accrual'").get(node.nodeId)?.total || 0);
  assert.equal(balanceLedger, sum(expectedWallets.map(user => user.balance)), `${context}: wallet value is not conserved against durable ledger entries`);
  const feeLedger = Number(node.ledger.db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS total FROM node_ai_ledger WHERE node_id=? AND kind='cerbanimo-platform-fee-accrual'").get(node.nodeId)?.total || 0);
  assert.equal(feeLedger, node.summary.platformFeeDueCents, `${context}: Cerbanimo fee accrual mismatch`);

  const summary = node.ledger.settlementSummary({ periodStart: SUMMARY_START, periodEnd: SUMMMARY_END });
  assert.equal(summary.topupCount, node.summary.topupCount, `${context}: top-up count summary mismatch`);
  assert.equal(summary.grossTopupsCents, node.summary.grossTopupsCents, `${context}: gross top-up summary mismatch`);
  assert.equal(summary.processorFeesCents, node.summary.processorFeesCents, `${context}: processor fee summary mismatch`);
  assert.equal(summary.userCreditsIssuedCents, node.summary.userCreditsIssuedCents, `${context}: issued credit summary mismatch`);
  assert.equal(summary.platformFeeDueCents, node.summary.platformFeeDueCents, `${context}: platform fee summary mismatch`);
  assert.equal(summary.nodeNetCashCents, node.summary.nodeNetCashCents, `${context}: node net cash summary mismatch`);
  assert.equal(summary.usageReceiptCount, node.summary.usageReceiptCount, `${context}: usage receipt count mismatch`);
}

async function expectThrow(action, context) {
  let thrown = null;
  try { await action(); } catch (error) { thrown = error; }
  assert.ok(thrown, `${context}: expected operation to fail`);
  return thrown;
}

function openLedger(node) {
  return new NodeAiLedger({ databasePath: node.databasePath, nodeId: node.nodeId, operatorId: node.operatorId, platformFeeBps: node.platformFeeBps });
}

function addSource(node, source, userId, kind) { node.sources.set(source, { source, userId, kind }); }
function removeReservation(node, reservation) {
  node.reservationOwners.delete(reservation.id);
  node.users.get(reservation.userId)?.reservations.delete(reservation.id);
}

async function topUp(node, user, rng, state) {
  const duplicate = node.sources.size && rng.bool(0.28);
  if (duplicate) {
    const prior = pickMapValue(node.sources, rng);
    const actor = rng.bool(0.82) ? node.users.get(prior.userId) : differentUser(node, prior.userId, rng);
    const gross = rng.int(1, 5000), processor = rng.int(0, Math.floor(gross * 0.08));
    if (actor.userId !== prior.userId) {
      await expectThrow(() => node.ledger.creditTopUp.±êÈu§-¢»¬z²²‹«qâ¦¸¨®Ê.­Ç ®‹,	éí²
è²Êk¡Ç¬²ŠÅyàÛ)®‡²Ê+jØ¬¢ËZµéèÀË®‹,ºÇ«vêe‰Æ­zÚ)º—¥±ç(ËkzË¥¶zzWêÜ­çbµ:)R›¬z²iËh®ë¬‡l¢êÜx‡i®*+²‹«qè+¢Ëz{l‚º,²šèqë,¢±^x'§¶Êk¡Ç¬²ŠÚ¶+(²Ö­zz02Æ¬±êíz«š–·¬º[bué©¢×§¶ÚîyÛ©–'µëh¦êpjÉè¶'^šš-z{kzÛ«Ú)º—n¦Xœj×¬¢êÜzšâ¢»(º·iËh­§-¢»¬z²r‰ì¶
è²
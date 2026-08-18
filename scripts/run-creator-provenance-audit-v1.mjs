#!/usr/bin/env node
import fs from 'node:fs/promises';
import { runDailyProvenanceAudit } from '../lib/creator-provenance-audit-runner-v1.mjs';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}
function dayKey(value = new Date()) { return value.toISOString().slice(0, 10); }
function required(value, message) { if (!value) throw new Error(message); return value; }

const cli = args(process.argv.slice(2));
if (cli.help) {
  console.log('Usage: node scripts/run-creator-provenance-audit-v1.mjs --input receipts.json --guild guild-id [--day YYYY-MM-DD] [--output batch.json]');
  console.log('Set CIVWEAVE_PROVENANCE_AUDIT_SALT to a Guild-private secret of at least 16 characters.');
  process.exit(0);
}

const inputPath = required(cli.input, '--input is required.');
const guildId = required(cli.guild, '--guild is required.');
const secretSalt = required(process.env.CIVWEAVE_PROVENANCE_AUDIT_SALT, 'CIVWEAVE_PROVENANCE_AUDIT_SALT is required.');
const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const receipts = Array.isArray(input) ? input : input.receipts || [];
const result = await runDailyProvenanceAudit({
  guildId,
  dayKey: cli.day || input.dayKey || dayKey(),
  secretSalt,
  receipts,
  policy: input.policy || {},
  prioritySessionIds: input.prioritySessionIds || [],
  anomalySessionIds: input.anomalySessionIds || [],
  disputeSessionIds: input.disputeSessionIds || [],
  allowModelReview: input.allowModelReview !== false,
});

const output = `${JSON.stringify(result, null, 2)}\n`;
if (cli.output) await fs.writeFile(cli.output, output, 'utf8');
else process.stdout.write(output);

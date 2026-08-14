#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_INTERVAL_MS,
  DEFAULT_RETENTION,
  createFilesystemBackupStore,
  createNodeBackupScheduler,
  restoreNodeReconstructionBackup,
  runBackupCycle,
} from '../lib/node-reconstruction-backup-v1.mjs';

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[i + 1];
    if (!value || value.startsWith('--')) options[key] = true;
    else { options[key] = value; i += 1; }
  }
  return { command, options };
}

function required(options, name) {
  const value = options[name];
  if (!value || value === true) throw new Error(`--${name} is required.`);
  return value;
}

function readBackupKey() {
  const base64 = process.env.CIVWEAVE_NODE_BACKUP_KEY_B64;
  if (!base64) throw new Error('CIVWEAVE_NODE_BACKUP_KEY_B64 is required and must contain a 32-byte backup data-encryption key.');
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error('CIVWEAVE_NODE_BACKUP_KEY_B64 must decode to exactly 32 bytes.');
  return key;
}

async function snapshotExporter(snapshotPath) {
  const absolute = path.resolve(snapshotPath);
  return async () => {
    const parsed = JSON.parse(await readFile(absolute, 'utf8'));
    const records = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(records)) throw new Error('Snapshot JSON must be an array of backup records or an object with records[].');
    return records;
  };
}

async function moduleExporter(modulePath) {
  const absolute = path.resolve(modulePath);
  const imported = await import(`${pathToFileURL(absolute).href}?backup=${Date.now()}`);
  if (typeof imported.exportNodeBackupRecords !== 'function') {
    throw new Error('Backup source module must export async function exportNodeBackupRecords().');
  }
  return imported.exportNodeBackupRecords;
}

async function resolveExporter(options) {
  if (options.snapshot) return snapshotExporter(options.snapshot);
  if (options.source) return moduleExporter(options.source);
  throw new Error('Use --snapshot <json> or --source <module.mjs>.');
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help() {
  print({
    usage: [
      'node scripts/node-reconstruction-backup-v1.mjs once --store <dir> --source <module.mjs>',
      'node scripts/node-reconstruction-backup-v1.mjs once --store <dir> --snapshot <records.json>',
      'node scripts/node-reconstruction-backup-v1.mjs watch --store <dir> --source <module.mjs> [--interval-minutes 360]',
      'node scripts/node-reconstruction-backup-v1.mjs preview --store <dir> --manifest <manifest-id>',
      'node scripts/node-reconstruction-backup-v1.mjs verify --store <dir> --manifest <manifest-id>',
    ],
    environment: {
      CIVWEAVE_NODE_BACKUP_KEY_B64: 'required 32-byte data-encryption key, base64 encoded',
      CIVWEAVE_NODE_BACKUP_KEY_ID: 'required stable key identifier; never the key itself',
      CIVWEAVE_NODE_ID: 'optional source node identifier',
    },
    sourceModuleContract: 'export async function exportNodeBackupRecords() { return [{system,path,sensitivity,content,...}]; }',
  });
}

const { command, options } = parseArgs(process.argv.slice(2));
if (command === 'help' || command === '--help' || command === '-h') {
  help();
  process.exit(0);
}

const store = createFilesystemBackupStore(path.resolve(required(options, 'store')));
const key = readBackupKey();
const keyId = process.env.CIVWEAVE_NODE_BACKUP_KEY_ID;
if (!keyId) throw new Error('CIVWEAVE_NODE_BACKUP_KEY_ID is required.');
const sourceNodeId = process.env.CIVWEAVE_NODE_ID ?? null;

if (command === 'once') {
  const exportRecords = await resolveExporter(options);
  const result = await runBackupCycle({
    exportRecords,
    store,
    encryptionKey: key,
    keyId,
    sourceNodeId,
    retention: Number(options.retention ?? DEFAULT_RETENTION),
  });
  print({ ok: true, manifestId: result.manifestId, nodeRoot: result.manifest.nodeRoot, sequence: result.manifest.sequence, newObjects: result.newObjects, reusedObjects: result.reusedObjects, retention: result.retention });
} else if (command === 'watch') {
  const sourcePath = required(options, 'source');
  const intervalMinutes = Number(options['interval-minutes'] ?? (DEFAULT_INTERVAL_MS / 60_000));
  const intervalMs = intervalMinutes * 60_000;
  const retention = Number(options.retention ?? DEFAULT_RETENTION);
  const scheduler = createNodeBackupScheduler({
    intervalMs,
    runCycle: async () => {
      const exportRecords = await moduleExporter(sourcePath);
      const result = await runBackupCycle({ exportRecords, store, encryptionKey: key, keyId, sourceNodeId, retention });
      print({ ok: true, event: 'backup-complete', manifestId: result.manifestId, nodeRoot: result.manifest.nodeRoot, sequence: result.manifest.sequence, newObjects: result.newObjects, reusedObjects: result.reusedObjects });
      return result;
    },
    onError: (error) => process.stderr.write(`node-backup cycle failed: ${error instanceof Error ? error.message : String(error)}\n`),
  });
  await scheduler.runNow();
  scheduler.start();
  print({ ok: true, event: 'backup-scheduler-active', intervalMinutes, retention });
  await new Promise((resolve) => {
    const shutdown = () => { scheduler.stop(); resolve(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
} else if (command === 'preview' || command === 'verify') {
  const manifestId = required(options, 'manifest');
  const manifest = await store.getManifest(manifestId);
  const result = await restoreNodeReconstructionBackup({ manifest, store, encryptionKey: key, preview: true });
  print({ ok: true, manifestId, ...result });
} else {
  throw new Error(`Unknown command: ${command}`);
}

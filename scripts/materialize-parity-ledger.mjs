#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sharedDir = path.join(repoRoot, 'public', 'app', 'shared');
const outputPath = path.join(sharedDir, 'civweave-parity-ledger.json');

const encoded = (
  await Promise.all(
    [1, 2, 3, 4].map((part) =>
      fs.readFile(
        path.join(sharedDir, `civweave-parity-ledger.part${part}.b64`),
        'utf8',
      ),
    ),
  )
)
  .join('')
  .replace(/\s+/g, '');

const ledger = JSON.parse(
  gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'),
);
const shells = JSON.parse(
  await fs.readFile(path.join(sharedDir, 'cabinet-shells-v129.json'), 'utf8'),
);

ledger.version = shells.version;
for (const system of ledger.systems || []) {
  const shell = shells.systems?.[system.id];
  if (shell) system.interfaceShell = shell;
}

const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
await fs.writeFile(outputPath, serialized, 'utf8');
console.log(
  `Materialized ${path.relative(repoRoot, outputPath)} (${Buffer.byteLength(serialized)} bytes).`,
);

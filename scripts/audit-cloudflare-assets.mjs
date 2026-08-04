#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const sourceDir = resolve(repoRoot, 'public');
const limitBytes = 24 * 1024 * 1024;

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  throw new Error(`Cloudflare source directory not found: ${sourceDir}`);
}

const files = walkFiles(sourceDir)
  .map((file) => ({
    path: relative(sourceDir, file).replaceAll('\\', '/'),
    bytes: statSync(file).size,
  }))
  .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

const oversized = files.filter(({ bytes }) => bytes > limitBytes);
const nearLimit = files.filter(
  ({ bytes }) => bytes > 20 * 1024 * 1024 && bytes <= limitBytes,
);

console.log(
  `Scanned ${files.length} files under public/ for the Cloudflare Pages 24 MiB release boundary.`,
);

if (oversized.length) {
  console.error('\nFiles over 24 MiB:');
  for (const file of oversized) {
    console.error(
      `- ${file.path}: ${(file.bytes / 1024 / 1024).toFixed(2)} MiB (${file.bytes} bytes)`,
    );
  }
} else {
  console.log('No Cloudflare-hosted files exceed 24 MiB.');
}

if (nearLimit.length) {
  console.log('\nFiles between 20 MiB and 24 MiB:');
  for (const file of nearLimit) {
    console.log(
      `- ${file.path}: ${(file.bytes / 1024 / 1024).toFixed(2)} MiB (${file.bytes} bytes)`,
    );
  }
}

if (oversized.length) process.exitCode = 1;

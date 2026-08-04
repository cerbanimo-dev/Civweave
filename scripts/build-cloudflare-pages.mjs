#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sourceDir = resolve(repoRoot, "public");
const outputDir = resolve(repoRoot, ".cloudflare-pages");
const installerPath = resolve(
  sourceDir,
  "downloads/Commonweave-Mobile-Install-Kit.zip",
);
const pocketCampusSeedPath = resolve(
  sourceDir,
  "downloads/commonweave-pocket-campus.cwseed",
);
const parityMaterializer = resolve(scriptDir, "materialize-parity-ledger.mjs");
const maxCloudflareAssetBytes = 24 * 1024 * 1024;

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function runNodeScript(script, failureMessage) {
  const result = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(failureMessage);
}

function rebuildReleaseArtifacts() {
  runNodeScript(
    parityMaterializer,
    "Commonweave parity ledger materialization failed.",
  );
  runNodeScript(
    resolve(scriptDir, "build-mobile-install-kit.mjs"),
    "Commonweave release artifact rebuild failed.",
  );
}

function oversizedFiles(directory) {
  return walkFiles(directory)
    .map((file) => ({ file, bytes: statSync(file).size }))
    .filter(({ bytes }) => bytes > maxCloudflareAssetBytes)
    .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
}

function formatOversized(directory, files) {
  return files
    .map(
      ({ file, bytes }) =>
        `${relative(directory, file)} (${(bytes / 1024 / 1024).toFixed(2)} MiB; ${bytes} bytes)`,
    )
    .join("\n- ");
}

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  throw new Error(`Static source directory not found: ${sourceDir}`);
}

rebuildReleaseArtifacts();

for (const [label, file] of [
  ["Mobile installer", installerPath],
  ["Pocket Campus seed", pocketCampusSeedPath],
]) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`${label} not found: ${file}`);
  }
}

const sourceOversized = oversizedFiles(sourceDir);
if (sourceOversized.length) {
  throw new Error(
    `Cloudflare Pages 24 MiB release boundary exceeded by ${sourceOversized.length} hosted file(s):\n- ${formatOversized(sourceDir, sourceOversized)}\nReplace or rebuild every listed file before deploying.`,
  );
}

rmSync(outputDir, { recursive: true, force: true });

cpSync(sourceDir, outputDir, {
  recursive: true,
  force: true,
  filter(sourcePath) {
    const relativePath = relative(sourceDir, resolve(sourcePath));
    return !relativePath.split(sep).includes(".wrangler");
  },
});

const outputOversized = oversizedFiles(outputDir);
if (outputOversized.length) {
  throw new Error(
    `Cloudflare Pages output contains ${outputOversized.length} file(s) above 24 MiB:\n- ${formatOversized(outputDir, outputOversized)}`,
  );
}

const installerBytes = statSync(installerPath).size;
const seedBytes = statSync(pocketCampusSeedPath).size;
console.log(
  `Built .cloudflare-pages with mobile installer (${installerBytes} bytes) and portable Commonweave seed (${seedBytes} bytes).`,
);
console.log("All Cloudflare-hosted files are at or below 24 MiB.");

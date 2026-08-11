#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sourceDir = resolve(repoRoot, "public");
const outputDir = resolve(repoRoot, ".cloudflare-pages");
const installerPath = resolve(sourceDir, "downloads/Civweave-Mobile-Install-Kit.zip");
const pocketCampusSeedPath = resolve(sourceDir, "downloads/civweave-pocket-campus.cwseed");
const mapPackagePath = resolve(sourceDir, "downloads/Civweave-Map-v1.zip");
const mapChecksumPath = resolve(sourceDir, "downloads/Civweave-Map-v1.zip.sha256");
const parityMaterializer = resolve(scriptDir, "materialize-parity-ledger.mjs");
const transformerStage = resolve(scriptDir, "stage-transformers-assets.mjs");
const transformerV4Stage = resolve(scriptDir, "stage-transformers-v4-assets.mjs");
const mapRuntimeStage = resolve(scriptDir, "stage-maplibre-v275.mjs");
const federationDataStage = resolve(scriptDir, "stage-federation-finder-data-v274.mjs");
const mapPackageBuilder = resolve(scriptDir, "build-civweave-map-v1.mjs");
const validationSafe = resolve(scriptDir, "apply-confidence-weighted-validation-v1-safe.mjs");
const maxCloudflareAssetBytes = 24 * 1024 * 1024;

// These synchronizers are intentionally retained as cheap deterministic guards.
// Release artifacts, installer smoke tests, and pre-live metadata are produced and
// verified before merge; Pages must not rebuild them on the production hot path.
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
await import('./generate-asset-lockboard-catalog-v239.mjs');

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
  const result = spawnSync(process.execPath, [script], { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) throw new Error(failureMessage);
}

function runNodeScriptAsync(script, failureMessage) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [script], { cwd: repoRoot, stdio: "inherit" });
    child.once("error", rejectPromise);
    child.once("exit", code => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${failureMessage} Exit code: ${code}.`));
    });
  });
}

function oversizedFiles(directory) {
  return walkFiles(directory)
    .map(file => ({ file, bytes: statSync(file).size }))
    .filter(({ bytes }) => bytes > maxCloudflareAssetBytes)
    .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
}

function formatOversized(directory, files) {
  return files
    .map(({ file, bytes }) => `${relative(directory, file)} (${(bytes / 1024 / 1024).toFixed(2)} MiB; ${bytes} bytes)`)
    .join("\n- ");
}

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  throw new Error(`Static source directory not found: ${sourceDir}`);
}

if (existsSync(validationSafe)) {
  runNodeScript(validationSafe, "Confidence-weighted validation transform failed.");
}

// The remaining generated assets are genuinely absent from git and required by
// the deployed runtime. They are independent, so build them concurrently rather
// than serially. Map packaging runs afterward because it consumes the staged map
// runtime and federation atlas.
await Promise.all([
  runNodeScriptAsync(transformerStage, "Transformers.js staging failed."),
  runNodeScriptAsync(transformerV4Stage, "Transformers.js 4.2 Gemma 4 staging failed."),
  runNodeScriptAsync(mapRuntimeStage, "Civweave Map v1 renderer staging failed."),
  runNodeScriptAsync(federationDataStage, "Federation Finder atlas staging failed."),
  runNodeScriptAsync(parityMaterializer, "Civweave parity ledger materialization failed."),
]);

runNodeScript(mapPackageBuilder, "Civweave Map v1 package build failed.");

const requiredRuntimeAssets = [
  resolve(sourceDir, 'app/vendor/transformers/transformers.min.js'),
  resolve(sourceDir, 'app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs'),
  resolve(sourceDir, 'app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'),
  resolve(sourceDir, 'app/vendor/transformers-v4/transformers.min.js'),
  resolve(sourceDir, 'app/vendor/transformers-v4/wasm/ort-wasm-simd-threaded.jsep.mjs'),
  resolve(sourceDir, 'app/vendor/transformers-v4/wasm/ort-wasm-simd-threaded.jsep.wasm.part0'),
  resolve(sourceDir, 'app/vendor/transformers-v4/wasm/ort-wasm-simd-threaded.jsep.wasm.part1'),
  resolve(sourceDir, 'app/vendor/maplibre-v5.13.0/maplibre-gl.js'),
  resolve(sourceDir, 'app/vendor/maplibre-v5.13.0/maplibre-gl.css'),
  resolve(sourceDir, 'app/vendor/pmtiles-v4.4.1/pmtiles.js'),
  resolve(sourceDir, 'app/federation-finder-data/atlas-v274/manifest.json'),
  resolve(sourceDir, 'app/shared/civweave-parity-ledger.json'),
];
for (const required of requiredRuntimeAssets) {
  if (!existsSync(required) || !statSync(required).isFile()) {
    throw new Error(`Required generated runtime asset was not staged: ${relative(repoRoot, required)}`);
  }
}

for (const [label, file] of [
  ["Mobile installer", installerPath],
  ["Pocket Campus seed", pocketCampusSeedPath],
  ["Civweave Map v1", mapPackagePath],
  ["Civweave Map v1 checksum", mapChecksumPath],
]) {
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`${label} not found: ${file}`);
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

// Scan only the final publish tree. The old build recursively scanned source and
// output, doubling I/O after already doing multiple release-generation passes.
const outputOversized = oversizedFiles(outputDir);
if (outputOversized.length) {
  throw new Error(`Cloudflare Pages output contains ${outputOversized.length} file(s) above 24 MiB:\n- ${formatOversized(outputDir, outputOversized)}\n`);
}

const installerBytes = statSync(installerPath).size;
const seedBytes = statSync(pocketCampusSeedPath).size;
const mapBytes = statSync(mapPackagePath).size;
console.log(`Built .cloudflare-pages with mobile installer (${installerBytes} bytes), portable Civweave seed (${seedBytes} bytes), and Civweave Map v1 (${mapBytes} bytes).`);
console.log("Cloudflare publish hot path: runtime staging parallelized; release artifact rebuilds and installer smoke tests remain outside deploy.");
console.log("All Cloudflare-hosted files are at or below the 24 MiB Civweave project boundary.");

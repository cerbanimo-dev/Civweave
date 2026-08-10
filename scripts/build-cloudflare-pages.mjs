#!/usr/bin/env node

import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sourceDir = resolve(repoRoot, "public");
const outputDir = resolve(repoRoot, ".cloudflare-pages");
const installerPath = resolve(sourceDir,"downloads/Civweave-Mobile-Install-Kit.zip");
const pocketCampusSeedPath = resolve(sourceDir,"downloads/civweave-pocket-campus.cwseed");
const mapPackagePath = resolve(sourceDir,"downloads/Civweave-Map-v1.zip");
const mapChecksumPath = resolve(sourceDir,"downloads/Civweave-Map-v1.zip.sha256");
const parityMaterializer = resolve(scriptDir, "materialize-parity-ledger.mjs");
const transformerStage = resolve(scriptDir, "stage-transformers-assets.mjs");
const mapRuntimeStage = resolve(scriptDir, "stage-maplibre-v275.mjs");
const mapPackageBuilder = resolve(scriptDir, "build-civweave-map-v1.mjs");
const validationSafe = resolve(scriptDir, "apply-confidence-weighted-validation-v1-safe.mjs");
const portableZipScript = resolve(scriptDir, "portable-zip.mjs");
const maxCloudflareAssetBytes = 24 * 1024 * 1024;

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
function commandAvailable(command, args = ["-v"]) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "ignore" });
  return !result.error && result.status === 0;
}
function withPortableZipFallback(task) {
  if (process.platform === "win32" || commandAvailable("zip")) return task();
  if (!existsSync(portableZipScript)) throw new Error(`Portable ZIP writer not found: ${portableZipScript}`);
  const shimDir = mkdtempSync(join(tmpdir(), "civweave-portable-zip-"));
  const shimPath = join(shimDir, "zip");
  const previousPath = process.env.PATH;
  const previousNode = process.env.CIVWEAVE_NODE_BIN;
  const previousScript = process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT;
  writeFileSync(shimPath,'#!/bin/sh\nexec "$CIVWEAVE_NODE_BIN" "$CIVWEAVE_PORTABLE_ZIP_SCRIPT" "$@"\n',"utf8");
  chmodSync(shimPath, 0o755);
  process.env.PATH = `${shimDir}${delimiter}${previousPath || ""}`;
  process.env.CIVWEAVE_NODE_BIN = process.execPath;
  process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT = portableZipScript;
  console.log("System zip is unavailable; using the dependency-free Civweave ZIP writer.");
  try { return task(); }
  finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousNode === undefined) delete process.env.CIVWEAVE_NODE_BIN; else process.env.CIVWEAVE_NODE_BIN = previousNode;
    if (previousScript === undefined) delete process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT; else process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT = previousScript;
    rmSync(shimDir, { recursive: true, force: true });
  }
}
function rebuildReleaseArtifacts() {
  runNodeScript(parityMaterializer,"Civweave parity ledger materialization failed.");
  withPortableZipFallback(() => runNodeScript(resolve(scriptDir, "build-mobile-install-kit.mjs"),"Civweave release artifact rebuild failed."));
}
function oversizedFiles(directory) {
  return walkFiles(directory).map((file) => ({ file, bytes: statSync(file).size })).filter(({ bytes }) => bytes > maxCloudflareAssetBytes).sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
}
function formatOversized(directory, files) {
  return files.map(({ file, bytes }) => `${relative(directory, file)} (${(bytes / 1024 / 1024).toFixed(2)} MiB; ${bytes} bytes)`).join("\n- ");
}
if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) throw new Error(`Static source directory not found: ${sourceDir}`);

if (existsSync(validationSafe)) runNodeScript(validationSafe,"Confidence-weighted validation transform failed.");
else console.log('[Civweave] Confidence-weighted validation transform is not present on this branch; current main supplies it at merge time.');
runNodeScript(transformerStage,"Transformers.js staging failed. Cloudflare would otherwise publish downloadable model weights without the local inference runtime.");
for (const required of [
  resolve(sourceDir, 'app/vendor/transformers/transformers.min.js'),
  resolve(sourceDir, 'app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.mjs'),
  resolve(sourceDir, 'app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'),
]) {
  if (!existsSync(required) || !statSync(required).isFile()) throw new Error(`Required local-AI runtime asset was not staged: ${relative(repoRoot, required)}`);
}

runNodeScript(mapRuntimeStage,"Civweave Map v1 renderer staging failed. Offline map boot requires packaged MapLibre and PMTiles runtimes.");
for (const required of [
  resolve(sourceDir,'app/vendor/maplibre-v5.13.0/maplibre-gl.js'),
  resolve(sourceDir,'app/vendor/maplibre-v5.13.0/maplibre-gl.css'),
  resolve(sourceDir,'app/vendor/pmtiles-v4.4.1/pmtiles.js'),
]) {
  if (!existsSync(required) || !statSync(required).isFile()) throw new Error(`Required Civweave Map v1 runtime was not staged: ${relative(repoRoot, required)}`);
}
runNodeScript(mapPackageBuilder,"Civweave Map v1 package build failed.");
rebuildReleaseArtifacts();

for (const [label, file] of [
  ["Mobile installer", installerPath],
  ["Pocket Campus seed", pocketCampusSeedPath],
  ["Civweave Map v1", mapPackagePath],
  ["Civweave Map v1 checksum", mapChecksumPath],
]) {
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`${label} not found: ${file}`);
}
const sourceOversized = oversizedFiles(sourceDir);
if (sourceOversized.length) throw new Error(`Cloudflare Pages 24 MiB release boundary exceeded by ${sourceOversized.length} hosted file(s):\n- ${formatOversized(sourceDir, sourceOversized)}\nReplace or rebuild every listed file before deploying.`);
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
if (outputOversized.length) throw new Error(`Cloudflare Pages output contains ${outputOversized.length} file(s) above 24 MiB:\n- ${formatOversized(outputDir, outputOversized)}\n`);
const installerBytes = statSync(installerPath).size;
const seedBytes = statSync(pocketCampusSeedPath).size;
const mapBytes = statSync(mapPackagePath).size;
console.log(`Built .cloudflare-pages with mobile installer (${installerBytes} bytes), portable Civweave seed (${seedBytes} bytes), and Civweave Map v1 (${mapBytes} bytes).`);
console.log("All Cloudflare-hosted files are at or below 24 MiB, including local AI and Map v1 runtimes.");

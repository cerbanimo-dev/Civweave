#!/usr/bin/env node

import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { delimiter, dirname, join, relative, resolve, sep } from "node:path";
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
const mobileInstallBuilder = resolve(scriptDir, "build-mobile-install-kit.mjs");
const validationSafe = resolve(scriptDir, "apply-confidence-weighted-validation-v1-safe.mjs");
const portableZipScript = resolve(scriptDir, "portable-zip.mjs");
const maxCloudflareAssetBytes = 24 * 1024 * 1024;
const githubRepo = process.env.GITHUB_REPOSITORY || 'cerbanimo-dev/Civweave';

// Keep only cheap deterministic synchronizers in the deploy path. Expensive
// verification belongs in CI before merge, not in the CDN publish job.
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
await import('./generate-prelive-metadata-v281.mjs');
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

function commandAvailable(command, args=["-v"]) {
  const result=spawnSync(command,args,{cwd:repoRoot,stdio:"ignore"});
  return !result.error&&result.status===0;
}

function currentCommitSha(){
  const envSha=String(process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||'').trim();
  if(/^[a-f0-9]{40}$/i.test(envSha))return envSha.toLowerCase();
  const result=spawnSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'});
  const sha=String(result.stdout||'').trim();
  if(result.status!==0||!/^([a-f0-9]{40})$/i.test(sha))throw new Error('Unable to resolve the source commit for immutable download URLs.');
  return sha.toLowerCase();
}

function withPortableZipFallback(task) {
  if (process.platform === "win32" || commandAvailable("zip")) return task();
  if (!existsSync(portableZipScript)) throw new Error(`Portable ZIP writer not found: ${portableZipScript}`);
  const shimDir=mkdtempSync(join(tmpdir(),"civweave-portable-zip-"));
  const shimPath=join(shimDir,"zip");
  const previousPath=process.env.PATH;
  const previousNode=process.env.CIVWEAVE_NODE_BIN;
  const previousScript=process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT;
  writeFileSync(shimPath,'#!/bin/sh\nexec "$CIVWEAVE_NODE_BIN" "$CIVWEAVE_PORTABLE_ZIP_SCRIPT" "$@"\n',"utf8");
  chmodSync(shimPath,0o755);
  process.env.PATH=`${shimDir}${delimiter}${previousPath||""}`;
  process.env.CIVWEAVE_NODE_BIN=process.execPath;
  process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT=portableZipScript;
  console.log("System zip is unavailable; using the dependency-free Civweave ZIP writer.");
  try{return task()}
  finally{
    if(previousPath===undefined)delete process.env.PATH;else process.env.PATH=previousPath;
    if(previousNode===undefined)delete process.env.CIVWEAVE_NODE_BIN;else process.env.CIVWEAVE_NODE_BIN=previousNode;
    if(previousScript===undefined)delete process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT;else process.env.CIVWEAVE_PORTABLE_ZIP_SCRIPT=previousScript;
    rmSync(shimDir,{recursive:true,force:true});
  }
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

function externalizeKnowledgeSchoolZips(){
  const catalogPath=resolve(outputDir,'downloads','knowledge-schools','catalog.json');
  const zipDir=resolve(outputDir,'downloads','knowledge-schools','schools');
  if(!existsSync(catalogPath))throw new Error(`Knowledge-school catalog missing from Pages output: ${catalogPath}`);
  const catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
  if(catalog?.schema!=='civweave.knowledge-school-catalog.v1'||!Array.isArray(catalog.schools))throw new Error('Knowledge-school catalog cannot be externalized safely.');
  const commit=currentCommitSha();
  const base=`https://raw.githubusercontent.com/${githubRepo}/${commit}/public/downloads/knowledge-schools/`;
  for(const school of catalog.schools){
    const relativeZip=String(school?.zip_file||'');
    if(!relativeZip.startsWith('schools/')||relativeZip.includes('..'))throw new Error(`Unsafe knowledge-school ZIP path: ${relativeZip}`);
    school.download_url=new URL(relativeZip,base).href;
    school.download_origin='github-raw-commit';
    school.download_commit=commit;
  }
  catalog.download_policy={
    mode:'external-immutable-zips',
    origin:'github-raw-commit',
    source_commit:commit,
    checksum_required:true,
    pages_carries_zip_bytes:false,
  };
  writeFileSync(catalogPath,`${JSON.stringify(catalog,null,2)}\n`,'utf8');
  rmSync(zipDir,{recursive:true,force:true});
  console.log(`[Civweave] Externalized ${catalog.schools.length} optional knowledge-school ZIPs to commit-pinned GitHub raw URLs (${commit.slice(0,12)}); Pages retains catalog and checksums only.`);
}

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  throw new Error(`Static source directory not found: ${sourceDir}`);
}

if (existsSync(validationSafe)) {
  runNodeScript(validationSafe, "Confidence-weighted validation transform failed.");
}

// These generated runtime/data lanes are independent. Build them concurrently
// instead of serially blocking production on each network/package operation.
await Promise.all([
  runNodeScriptAsync(transformerStage, "Transformers.js staging failed."),
  runNodeScriptAsync(transformerV4Stage, "Transformers.js 4.2 Gemma 4 staging failed."),
  runNodeScriptAsync(mapRuntimeStage, "Civweave Map v1 renderer staging failed."),
  runNodeScriptAsync(federationDataStage, "Federation Finder atlas staging failed."),
  runNodeScriptAsync(parityMaterializer, "Civweave parity ledger materialization failed."),
]);

// Map packaging consumes the staged renderer/atlas. Pocket Campus packaging is
// tiny but still owns the uncommitted public seed, so retain it with the portable
// ZIP shim while keeping the expensive verification suite out of deployment.
runNodeScript(mapPackageBuilder, "Civweave Map v1 package build failed.");
withPortableZipFallback(() => runNodeScript(mobileInstallBuilder, "Civweave mobile/Pocket Campus package build failed."));

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
externalizeKnowledgeSchoolZips();

// Audit the actual publish tree once. The old deploy recursively scanned both
// source and output, doubling filesystem I/O after already rebuilding artifacts.
const outputOversized = oversizedFiles(outputDir);
if (outputOversized.length) {
  throw new Error(`Cloudflare Pages output contains ${outputOversized.length} file(s) above 24 MiB:\n- ${formatOversized(outputDir, outputOversized)}\n`);
}

const installerBytes = statSync(installerPath).size;
const seedBytes = statSync(pocketCampusSeedPath).size;
const mapBytes = statSync(mapPackagePath).size;
console.log(`Built .cloudflare-pages with mobile installer (${installerBytes} bytes), portable Civweave seed (${seedBytes} bytes), and Civweave Map v1 (${mapBytes} bytes).`);
console.log("Cloudflare publish hot path: generated runtime/data staging parallelized; optional knowledge-school ZIP bytes externalized to immutable commit-pinned downloads.");
console.log("All Cloudflare-hosted files are at or below 24 MiB, including the split Gemma 4 runtime and Map v1 runtimes.");

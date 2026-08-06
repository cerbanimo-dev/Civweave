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
const installerPath = resolve(
  sourceDir,
  "downloads/Commonweave-Mobile-Install-Kit.zip",
);
const pocketCampusSeedPath = resolve(
  sourceDir,
  "downloads/commonweave-pocket-campus.cwseed",
);
const parityMaterializer = resolve(scriptDir, "materialize-parity-ledger.mjs");
const portableZipScript = resolve(scriptDir, "portable-zip.mjs");
const maxCloudflareAssetBytes = 24 * 1024 * 1024;

await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');

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

function commandAvailable(command, args = ["-v"]) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "ignore" });
  return !result.error && result.status === 0;
}

function withPortableZipFallback(task) {
  if (process.platform === "win32" || commandAvailable("zip")) return task();
  if (!existsSync(portableZipScript)) {
    throw new Error(`Portable ZIP writer not found: ${portableZipScript}`);
  }

  const shimDir = mkdtempSync(join(tmpdir(), "commonweave-portable-zip-"));
  const shimPath = join(shimDir, "zip");
  const previousPath = process.env.PATH;
  const previousNode = process.env.COMMONWEAVE_NODE_BIN;
  const previousScript = process.env.COMMONWEAVE_PORTABLE_ZIP_SCRIPT;
  writeFileSync(
    shimPath,
    '#!/bin/sh\nexec "$COMMONWEAVE_NODE_BIN" "$COMMONWEAVE_PORTABLE_ZIP_SCRIPT" "$@"\n',
    "utf8",
  );
  chmodSync(shimPath, 0o755);
  process.env.PATH = `${shimDir}${delimiter}${previousPath || ""}`;
  process.env.COMMONWEAVE_NODE_BIN = process.execPath;
  process.env.COMMONWEAVE_PORTABLE_ZIP_SCRIPT = portableZipScript;
  console.log("System zip is unavailable; using the dependency-free Commonweave ZIP writer.");

  try {
    return task();
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousNode === undefined) delete process.env.COMMONWEAVE_NODE_BIN;
    else process.env.COMMONWEAVE_NODE_BIN = previousNode;
    if (previousScript === undefined) delete process.env.COMMONWEAVE_PORTABLE_ZIP_SCRIPT;
    else process.env.COMMONWEAVE_PORTABLE_ZIP_SCRIPT = previousScript;
    rmSync(shimDir, { recursive: true, force: true });
  }
}

function rebuildReleaseArtifacts() {
  runNodeScript(
    parityMaterializer,
    "Commonweave parity ledger materialization failed.",
  );
  withPortableZipFallback(() => runNodeScript(
    resolve(scriptDir, "build-mobile-install-kit.mjs"),
    "Commonweave release artifact rebuild failed.",
  ));
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

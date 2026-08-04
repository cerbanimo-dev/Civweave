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
const maxCloudflareAssetBytes = 25 * 1024 * 1024;

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function rebuildReleaseArtifacts() {
  const result = spawnSync(
    process.execPath,
    [resolve(scriptDir, "build-mobile-install-kit.mjs")],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("Commonweave release artifact rebuild failed.");
  }
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

rmSync(outputDir, { recursive: true, force: true });

cpSync(sourceDir, outputDir, {
  recursive: true,
  force: true,
  filter(sourcePath) {
    const relativePath = relative(sourceDir, resolve(sourcePath));
    return !relativePath.split(sep).includes(".wrangler");
  },
});

const oversizedAssets = walkFiles(outputDir)
  .map((file) => ({ file, bytes: statSync(file).size }))
  .filter(({ bytes }) => bytes > maxCloudflareAssetBytes);

if (oversizedAssets.length) {
  const details = oversizedAssets
    .map(
      ({ file, bytes }) =>
        `${relative(outputDir, file)} (${(bytes / 1024 / 1024).toFixed(2)} MiB)`,
    )
    .join(", ");
  throw new Error(
    `Cloudflare Pages asset limit exceeded: ${details}. Replace or rebuild these files below 25 MiB before deploying.`,
  );
}

const installerBytes = statSync(installerPath).size;
const seedBytes = statSync(pocketCampusSeedPath).size;
console.log(
  `Built .cloudflare-pages with mobile installer (${installerBytes} bytes) and portable Commonweave seed (${seedBytes} bytes).`,
);

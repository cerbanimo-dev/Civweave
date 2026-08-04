#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
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

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  throw new Error(`Static source directory not found: ${sourceDir}`);
}

if (!existsSync(installerPath) || !statSync(installerPath).isFile()) {
  throw new Error(`Mobile installer not found: ${installerPath}`);
}

const installerBytes = statSync(installerPath).size;
if (installerBytes > maxCloudflareAssetBytes) {
  throw new Error(
    `Mobile installer is ${installerBytes} bytes, above Cloudflare's 25 MiB per-asset limit.`,
  );
}

rmSync(outputDir, { recursive: true, force: true });

cpSync(sourceDir, outputDir, {
  recursive: true,
  force: true,
  filter(sourcePath) {
    const resolved = resolve(sourcePath);
    if (
      resolved === pocketCampusSeedPath ||
      resolved === `${pocketCampusSeedPath}.sha256`
    ) {
      return false;
    }

    const relativePath = relative(sourceDir, resolved);
    return !relativePath.split(sep).includes(".wrangler");
  },
});

const oversizedAssets = walkFiles(outputDir)
  .map((file) => ({
    file,
    bytes: statSync(file).size,
  }))
  .filter(({ bytes }) => bytes > maxCloudflareAssetBytes);

if (oversizedAssets.length) {
  const details = oversizedAssets
    .map(
      ({ file, bytes }) =>
        `${relative(outputDir, file)} (${(bytes / 1024 / 1024).toFixed(2)} MiB)`,
    )
    .join(", ");
  throw new Error(`Cloudflare Pages asset limit exceeded: ${details}`);
}

console.log(
  `Built .cloudflare-pages with Commonweave-Mobile-Install-Kit.zip (${installerBytes} bytes).`,
);
console.log(
  "Kept commonweave-pocket-campus.cwseed on the Render host node; it is intentionally excluded from Pages.",
);

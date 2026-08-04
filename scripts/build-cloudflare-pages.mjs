#!/usr/bin/env node

import { cpSync, existsSync, rmSync, statSync } from "node:fs";
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
const maxCloudflareAssetBytes = 25 * 1024 * 1024;

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
    const relativePath = relative(sourceDir, resolve(sourcePath));
    return !relativePath.split(sep).includes(".wrangler");
  },
});

console.log(
  `Built .cloudflare-pages with Commonweave-Mobile-Install-Kit.zip (${installerBytes} bytes).`,
);

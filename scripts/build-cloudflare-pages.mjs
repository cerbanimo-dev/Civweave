#!/usr/bin/env node

import { cpSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sourceDir = resolve(repoRoot, "public");
const outputDir = resolve(repoRoot, ".cloudflare-pages");
const excludedInstaller = resolve(
  sourceDir,
  "downloads/Commonweave-Mobile-Install-Kit.zip",
);

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  throw new Error(`Static source directory not found: ${sourceDir}`);
}

rmSync(outputDir, { recursive: true, force: true });

cpSync(sourceDir, outputDir, {
  recursive: true,
  force: true,
  filter(sourcePath) {
    const resolved = resolve(sourcePath);
    if (resolved === excludedInstaller) {
      return false;
    }

    const relativePath = relative(sourceDir, resolved);
    if (relativePath === ".assetsignore") {
      return false;
    }

    return !relativePath.split(sep).includes(".wrangler");
  },
});

console.log(
  "Built .cloudflare-pages without Commonweave-Mobile-Install-Kit.zip; Pages Functions serve that URL from R2.",
);

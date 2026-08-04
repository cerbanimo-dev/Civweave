#!/usr/bin/env node

import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const installerPath = resolve(
  repoRoot,
  "public/downloads/Commonweave-Mobile-Install-Kit.zip",
);
const buildScript = resolve(repoRoot, "scripts/build-cloudflare-pages.mjs");
const pagesOutput = resolve(repoRoot, ".cloudflare-pages");
const bucketName = "commonweave-downloads";
const objectKey = "Commonweave-Mobile-Install-Kit.zip";
const projectName =
  process.env.CLOUDFLARE_PAGES_PROJECT ||
  process.argv[2] ||
  "commonweave-cloudflare-node";

function detectWrangler() {
  const candidates =
    process.platform === "win32"
      ? [
          { command: "wrangler.cmd", prefix: [] },
          { command: "npx.cmd", prefix: ["wrangler"] },
        ]
      : [
          { command: "wrangler", prefix: [] },
          { command: "npx", prefix: ["wrangler"] },
        ];

  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.prefix, "--version"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.status === 0) return candidate;
  }

  throw new Error(
    "Wrangler was not found. Install it or ensure the wrangler command is on PATH.",
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) process.stderr.write(output);
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return { status: result.status ?? 1, output };
}

function runWrangler(wrangler, args, options = {}) {
  return run(wrangler.command, [...wrangler.prefix, ...args], options);
}

function includesNamedResource(output, name) {
  try {
    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : parsed.result ?? parsed.projects ?? [];
    return items.some(
      (item) => item?.name === name || item?.bucket_name === name || item?.title === name,
    );
  } catch {
    return output.includes(name);
  }
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

if (!existsSync(installerPath)) {
  throw new Error(
    `Installer not found at ${installerPath}. Run npm run build:install or restore the release file first.`,
  );
}

const wrangler = detectWrangler();
const installerSize = statSync(installerPath).size;

console.log("Commonweave Cloudflare Pages + R2 setup");
console.log(`Pages project: ${projectName}`);
console.log(`R2 bucket: ${bucketName}`);
console.log(`Installer: ${formatMiB(installerSize)}`);

console.log("\n1/5 Checking Cloudflare authentication...");
runWrangler(wrangler, ["whoami"]);

console.log("\n2/5 Ensuring the R2 bucket exists...");
const buckets = runWrangler(wrangler, ["r2", "bucket", "list", "--json"], {
  capture: true,
});
if (!includesNamedResource(buckets.output, bucketName)) {
  runWrangler(wrangler, ["r2", "bucket", "create", bucketName]);
} else {
  console.log(`R2 bucket ${bucketName} already exists.`);
}

console.log("\n3/5 Ensuring the Pages project exists...");
const projects = runWrangler(wrangler, ["pages", "project", "list", "--json"], {
  capture: true,
});
if (!includesNamedResource(projects.output, projectName)) {
  runWrangler(wrangler, [
    "pages",
    "project",
    "create",
    projectName,
    "--production-branch",
    "main",
  ]);
} else {
  console.log(`Pages project ${projectName} already exists.`);
}

console.log("\n4/5 Uploading the installer to R2...");
runWrangler(wrangler, [
  "r2",
  "object",
  "put",
  `${bucketName}/${objectKey}`,
  "--file",
  installerPath,
  "--content-type",
  "application/zip",
  "--content-disposition",
  `attachment; filename="${objectKey}"`,
  "--cache-control",
  "public, max-age=3600",
  "--remote",
]);

console.log("\n5/5 Building and deploying Cloudflare Pages...");
run(process.execPath, [buildScript]);
runWrangler(wrangler, [
  "pages",
  "deploy",
  pagesOutput,
  "--project-name",
  projectName,
  "--branch",
  "main",
  "--config",
  "wrangler.jsonc",
]);

console.log("\nCloudflare Pages setup complete.");
console.log(`Production URL: https://${projectName}.pages.dev`);
console.log(`Health: https://${projectName}.pages.dev/api/health`);
console.log(
  `Installer: https://${projectName}.pages.dev/downloads/${objectKey}`,
);

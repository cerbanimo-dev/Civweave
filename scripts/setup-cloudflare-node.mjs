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
const bucketName = "commonweave-downloads";
const objectKey = "Commonweave-Mobile-Install-Kit.zip";

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

    if (result.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    "Wrangler was not found. Install it or ensure the wrangler command is on PATH.",
  );
}

function run(wrangler, args, options = {}) {
  const result = spawnSync(
    wrangler.command,
    [...wrangler.prefix, ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
    },
  );

  if (options.capture) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status !== 0 && !options.allowFailure) {
      process.stderr.write(output);
      throw new Error(`Wrangler command failed: ${args.join(" ")}`);
    }
    return { status: result.status ?? 1, output };
  }

  if (result.status !== 0) {
    throw new Error(`Wrangler command failed: ${args.join(" ")}`);
  }

  return { status: 0, output: "" };
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

if (!existsSync(installerPath)) {
  throw new Error(
    `Installer not found at ${installerPath}. Build or restore it before running this setup.`,
  );
}

const wrangler = detectWrangler();
const installerSize = statSync(installerPath).size;

console.log(`Commonweave Cloudflare setup`);
console.log(`Installer: ${formatMiB(installerSize)}`);
console.log(`R2 bucket: ${bucketName}`);

console.log("\n1/4 Checking Cloudflare authentication...");
run(wrangler, ["whoami"]);

console.log("\n2/4 Ensuring the R2 bucket exists...");
const listedBuckets = run(wrangler, ["r2", "bucket", "list"], {
  capture: true,
});

if (!listedBuckets.output.includes(bucketName)) {
  run(wrangler, ["r2", "bucket", "create", bucketName]);
} else {
  console.log(`R2 bucket ${bucketName} already exists.`);
}

console.log("\n3/4 Uploading the installer to R2...");
run(wrangler, [
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

console.log("\n4/4 Deploying the Worker and static asset mirror...");
run(wrangler, ["deploy", "--config", "wrangler.jsonc"]);

console.log("\nCloudflare setup complete.");
console.log("Test /api/health and /downloads/Commonweave-Mobile-Install-Kit.zip on the workers.dev URL printed above.");

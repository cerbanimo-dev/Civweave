#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const buildScript = resolve(repoRoot, "scripts/build-cloudflare-pages.mjs");
const pagesOutput = resolve(repoRoot, ".cloudflare-pages");
// Keep the legacy Cloudflare project identifier stable. The public product is
// Civweave, but existing installs and production traffic are origin-bound to
// commonweave.pages.dev. Renaming the Pages project would create a different
// origin rather than upgrading those installs.
const projectName =
  process.env.CLOUDFLARE_PAGES_PROJECT ||
  process.argv[2] ||
  "commonweave";

function detectWrangler() {
  const localWranglerJs = resolve(
    repoRoot,
    "node_modules/wrangler/bin/wrangler.js",
  );

  const candidates = [];
  if (existsSync(localWranglerJs)) {
    candidates.push({
      command: process.execPath,
      prefix: [localWranglerJs],
      shell: false,
    });
  }

  if (process.platform === "win32") {
    candidates.push(
      { command: "wrangler.cmd", prefix: [], shell: true },
      { command: "npx.cmd", prefix: ["wrangler"], shell: true },
    );
  } else {
    candidates.push(
      { command: "wrangler", prefix: [], shell: false },
      { command: "npx", prefix: ["wrangler"], shell: false },
    );
  }

  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.prefix, "--version"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        shell: candidate.shell,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    if (result.status === 0) return candidate;
  }

  throw new Error(
    "Wrangler was not found. Run npm install --save-dev wrangler, then retry.",
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: options.shell ?? false,
    stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) process.stderr.write(output);
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return { status: result.status ?? 1, output };
}

function runWrangler(wrangler, args, options = {}) {
  return run(wrangler.command, [...wrangler.prefix, ...args], {
    ...options,
    shell: wrangler.shell,
  });
}

function includesNamedProject(output, name) {
  try {
    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed)
      ? parsed
      : parsed.result ?? parsed.projects ?? [];
    return items.some((item) => item?.name === name || item?.title === name);
  } catch {
    return output.includes(name);
  }
}

const wrangler = detectWrangler();

console.log("Civweave Cloudflare Pages setup");
console.log(`Pages project: ${projectName}`);

console.log("\n1/3 Checking Cloudflare authentication...");
runWrangler(wrangler, ["whoami"]);

console.log("\n2/3 Ensuring the Pages project exists...");
const projects = runWrangler(wrangler, ["pages", "project", "list", "--json"], {
  capture: true,
});
if (!includesNamedProject(projects.output, projectName)) {
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

console.log("\n3/3 Building and deploying Cloudflare Pages...");
run(process.execPath, [buildScript]);
runWrangler(wrangler, [
  "pages",
  "deploy",
  pagesOutput,
  "--project-name",
  projectName,
  "--branch",
  "main",
  "--commit-dirty=true",
]);

console.log("\nCloudflare Pages setup complete.");
console.log(`Production URL: https://${projectName}.pages.dev`);
console.log(`Health: https://${projectName}.pages.dev/api/health`);

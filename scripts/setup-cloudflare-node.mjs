#!/usr/bin/env node

import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const buildScript = resolve(repoRoot, "scripts/build-cloudflare-pages.mjs");
const pagesOutput = resolve(repoRoot, ".cloudflare-pages");
const canonicalProjectName = "civweave";
const canonicalOrigin = `https://${canonicalProjectName}.pages.dev`;

function normalizeHostId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseArgs(argv) {
  let canonical = false;
  let hostId = normalizeHostId(process.env.CIVWEAVE_HOST_ID);
  let projectName = String(process.env.CLOUDFLARE_PAGES_PROJECT || "").trim().toLowerCase();
  let expectAccountEmail = String(process.env.CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL || "").trim().toLowerCase();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--canonical") canonical = true;
    else if (arg === "--host-id") hostId = normalizeHostId(argv[++i]);
    else if (arg === "--project-name" || arg === "--project") projectName = String(argv[++i] || "").trim().toLowerCase();
    else if (arg === "--expect-account-email") expectAccountEmail = String(argv[++i] || "").trim().toLowerCase();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Civweave Cloudflare host setup\n\nCanonical root:\n  CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL=you@example.com node scripts/setup-cloudflare-node.mjs --canonical\n\nCommunity host:\n  node scripts/setup-cloudflare-node.mjs --host-id garden\n\nCommunity host with a custom Pages project name:\n  node scripts/setup-cloudflare-node.mjs --host-id garden --project-name garden\n\nDefaults:\n  canonical: ${canonicalOrigin}\n  community: https://civweave-<host-id>.pages.dev`);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  if (canonical && hostId) throw new Error("Choose either --canonical or --host-id, not both.");
  if (canonical) {
    if (projectName && projectName !== canonicalProjectName) throw new Error(`Canonical Civweave must deploy to the reserved Pages project ${canonicalProjectName}.`);
    if (!expectAccountEmail) throw new Error("Canonical deployment requires CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL or --expect-account-email so Wrangler cannot silently publish the root from the wrong Cloudflare account.");
    return { canonical: true, hostId: "civweave", projectName: canonicalProjectName, expectAccountEmail };
  }

  if (!hostId) throw new Error("Choose a host ID with --host-id <name>. Use --canonical only for the reserved civweave.pages.dev root.");
  if (projectName === canonicalProjectName) throw new Error("The civweave Pages project is reserved for the canonical root. Choose another project name for a community host.");
  projectName ||= `civweave-${hostId}`;
  return { canonical: false, hostId, projectName, expectAccountEmail };
}

function detectWrangler() {
  const localWranglerJs = resolve(repoRoot, "node_modules/wrangler/bin/wrangler.js");
  const candidates = [];
  if (existsSync(localWranglerJs)) candidates.push({ command: process.execPath, prefix: [localWranglerJs], shell: false });
  if (process.platform === "win32") candidates.push({ command: "wrangler.cmd", prefix: [], shell: true }, { command: "npx.cmd", prefix: ["wrangler"], shell: true });
  else candidates.push({ command: "wrangler", prefix: [], shell: false }, { command: "npx", prefix: ["wrangler"], shell: false });

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: candidate.shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    if (result.status === 0) return candidate;
  }
  throw new Error("Wrangler was not found. Run npm install --save-dev wrangler@latest, then retry.");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: options.shell ?? false,
    env: { ...process.env, ...(options.env || {}) },
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
  return run(wrangler.command, [...wrangler.prefix, ...args], { ...options, shell: wrangler.shell });
}

function includesNamedProject(output, name) {
  try {
    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : parsed.result ?? parsed.projects ?? [];
    return items.some(item => item?.name === name || item?.title === name);
  } catch {
    return output.includes(name);
  }
}

const options = parseArgs(process.argv.slice(2));
const wrangler = detectWrangler();

console.log("Civweave Cloudflare host setup");
console.log(`Role: ${options.canonical ? "canonical root" : "community host"}`);
console.log(`Host ID: ${options.hostId}`);
console.log(`Pages project: ${options.projectName}`);
if (options.expectAccountEmail) console.log(`Required Cloudflare account: ${options.expectAccountEmail}`);

console.log("\n1/4 Checking Cloudflare authentication...");
const whoami = runWrangler(wrangler, ["whoami"], { capture: true });
process.stdout.write(whoami.output);
if (options.expectAccountEmail && !whoami.output.toLowerCase().includes(options.expectAccountEmail)) {
  throw new Error(`Wrangler is not authenticated as the expected Cloudflare account email ${options.expectAccountEmail}. Run npx wrangler logout, then npx wrangler login with the intended account before retrying.`);
}

console.log("\n2/4 Ensuring the Pages project exists...");
const projects = runWrangler(wrangler, ["pages", "project", "list", "--json"], { capture: true });
if (!includesNamedProject(projects.output, options.projectName)) {
  runWrangler(wrangler, ["pages", "project", "create", options.projectName, "--production-branch", "main"]);
} else {
  console.log(`Pages project ${options.projectName} already exists.`);
}

console.log("\n3/4 Building the host package...");
run(process.execPath, [buildScript]);
const productionUrl = `https://${options.projectName}.pages.dev`;
writeFileSync(resolve(pagesOutput, "app", "host-deployment-v1.json"), `${JSON.stringify({
  schema: "civweave.host-deployment.v1",
  role: options.canonical ? "canonical" : "community",
  hostId: options.hostId,
  pagesProject: options.projectName,
  publicOrigin: productionUrl,
  canonicalOrigin,
  localAnchorRecommended: true,
  localAnchorRequired: false,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`, "utf8");

console.log("\n4/4 Deploying Cloudflare Pages...");
runWrangler(wrangler, ["pages", "deploy", pagesOutput, "--project-name", options.projectName, "--branch", "main", "--commit-dirty=true"]);

console.log("\nCivweave Cloudflare host setup complete.");
console.log(`Production URL: ${productionUrl}`);
console.log(`Health: ${productionUrl}/api/health`);
console.log(`Steward setup: ${productionUrl}/app/?host_setup=1`);
if (options.canonical) console.log(`Canonical Civweave root: ${canonicalOrigin}`);
console.log("Open the steward setup URL once. Civweave will then keep reminding this steward browser to add and pair a local Anchor/companion until it is recorded as complete.");

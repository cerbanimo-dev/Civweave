import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const policy = JSON.parse(readFileSync(path.join(process.cwd(), 'config', 'convergence-policy.json'), 'utf8'));
const failures = [];
const warnings = [];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function determineBase() {
  const explicit = process.env.CONVERGENCE_BASE_REF;
  if (explicit) return explicit;

  const githubBase = process.env.GITHUB_BASE_REF;
  if (githubBase) {
    const remoteRef = `origin/${githubBase}`;
    try {
      git(['rev-parse', '--verify', remoteRef]);
      return remoteRef;
    } catch {
      return githubBase;
    }
  }

  try {
    git(['rev-parse', '--verify', 'HEAD^']);
    return 'HEAD^';
  } catch {
    return null;
  }
}

function isExecutableRuntime(filePath) {
  return /\.(?:html?|js|mjs|cjs)$/i.test(filePath);
}

function isAllowedNewRuntime(filePath) {
  if (policy.activeDemolitionLane.allowedNewRuntimePaths.includes(filePath)) return true;
  return policy.allowedRuntimeDirectories.some((directory) => filePath.startsWith(directory));
}

function parseNameStatus(output) {
  if (!output) return [];
  return output.split('\n').map((line) => {
    const parts = line.split('\t');
    const status = parts[0];
    const filePath = status.startsWith('R') ? parts[2] : parts[1];
    return { status, path: filePath };
  }).filter((item) => item.path);
}

function parseAddedLines(diff) {
  const additions = [];
  let currentFile = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      continue;
    }
    if (!currentFile || !line.startsWith('+') || line.startsWith('+++')) continue;
    additions.push({ file: currentFile, line: line.slice(1) });
  }
  return additions;
}

const base = determineBase();
if (!base) {
  warnings.push('No comparison base was available; path and added-line guards were skipped.');
} else {
  const range = `${base}...HEAD`;
  let changedFiles = [];
  let additions = [];
  try {
    changedFiles = parseNameStatus(git(['diff', '--name-status', '--find-renames', range]));
    additions = parseAddedLines(git(['diff', '--unified=0', '--no-color', range]));
  } catch (error) {
    failures.push(`Could not inspect convergence diff against ${base}: ${error.message}`);
  }

  const changedPaths = new Set(changedFiles.map((item) => item.path));
  const addedFiles = changedFiles.filter((item) => item.status === 'A').map((item) => item.path);

  for (const filePath of addedFiles) {
    if (/^server-v\d+\.mjs$/i.test(filePath)) {
      failures.push(`${filePath}: new versioned server entrypoints are forbidden during convergence.`);
    }
    if (/^public\/service-worker-v\d+\.js$/i.test(filePath)) {
      failures.push(`${filePath}: new versioned service workers are forbidden during convergence.`);
    }
    if (filePath.startsWith('public/app/') && isExecutableRuntime(filePath)) {
      const versioned = /-v\d+(?:\.[a-z0-9]+)?$/i.test(path.posix.basename(filePath, path.posix.extname(filePath)));
      if (versioned && !policy.activeDemolitionLane.allowedNewRuntimePaths.includes(filePath)) {
        failures.push(`${filePath}: new version-suffixed app runtimes are forbidden outside the active demolition lane.`);
      }
      if (!isAllowedNewRuntime(filePath)) {
        failures.push(`${filePath}: new app runtime must live under a canonical realms/shared directory or an isolated compat/migration directory.`);
      }
    }
  }

  const protectedChanged = policy.protectedArchitectureFiles.filter((filePath) => changedPaths.has(filePath));
  if (protectedChanged.length && !changedPaths.has('config/convergence-policy.json')) {
    failures.push(`Architecture boundary changed without updating convergence policy: ${protectedChanged.join(', ')}`);
  }

  if (changedPaths.has('public/app/fullscreen-family-v104.html') && !changedPaths.has('public/app/app-manifest.json')) {
    failures.push('Dispatcher changes must update public/app/app-manifest.json in the same pull request.');
  }

  if ([...changedPaths].some((filePath) => /^public\/service-worker(?:-v\d+)?\.js$/.test(filePath)) &&
      !changedPaths.has('public/app/app-manifest.json') &&
      !changedPaths.has('config/convergence-policy.json')) {
    failures.push('Service-worker changes must be accompanied by the application manifest or convergence policy.');
  }

  const forbiddenPatterns = [
    {
      name: 'synthetic click relay',
      pattern: /\.click\s*\(\s*\)/,
      scope: (file) => isExecutableRuntime(file) && !file.startsWith('scripts/')
    },
    {
      name: 'mutation-observer routing',
      pattern: /new\s+MutationObserver\s*\(/,
      scope: (file) => isExecutableRuntime(file) && !file.startsWith('scripts/')
    },
    {
      name: 'hidden launcher',
      pattern: /(?:hidden\s*=\s*["']?hidden|aria-hidden\s*=\s*["']true["']).*(?:moss|kamiya|rook|merlin|compass|guide)/i,
      scope: (file) => /\.html?$/i.test(file)
    },
    {
      name: 'runtime source evaluation',
      pattern: /(?:new\s+Function|\bFunction)\s*\(/,
      scope: (file) => /^(?:server|scripts\/build|public\/service-worker)/.test(file)
    },
    {
      name: 'family shell cross-realm storage read',
      pattern: /localStorage\.(?:getItem|setItem)\s*\(\s*["']commonweave\.(?:living-school|cerbanimo|fellowfare|anarchadia)/,
      scope: (file) => file === 'public/app/family-shell-v104.js'
    }
  ];

  for (const addition of additions) {
    for (const rule of forbiddenPatterns) {
      if (rule.scope(addition.file) && rule.pattern.test(addition.line)) {
        failures.push(`${addition.file}: added ${rule.name}: ${addition.line.trim().slice(0, 140)}`);
      }
    }
  }
}

if (policy.phase !== 'wave-0-lock') {
  warnings.push(`Policy phase is ${policy.phase}; this verifier was introduced for wave-0-lock and should evolve with the program.`);
}

for (const warning of warnings) console.warn(`CONVERGENCE WARNING: ${warning}`);
if (failures.length) {
  console.error('\nCommonweave convergence guardrails failed:\n');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`Commonweave convergence guardrails passed${base ? ` against ${base}` : ''}.`);
console.log(`Active demolition lane: ${policy.activeDemolitionLane.realm} (PR #${policy.activeDemolitionLane.pullRequest}).`);

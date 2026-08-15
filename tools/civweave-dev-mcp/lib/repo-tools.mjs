import { access, lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MAX_READ_BYTES = 256_000;
const MAX_SEARCH_RESULTS = 200;
const TEXT_EXTENSIONS = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.md','.html','.css','.scss','.yml','.yaml','.toml','.txt','.sh','.cmd','.ps1','.py','.sql','.xml','.svg','.env']);
const EXCLUDED_DIRS = new Set(['.git','node_modules','dist','build','coverage','.next','.cache']);

export function resolveRepoPath(repoRoot, requested = '.') {
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, requested);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Path escapes the configured repository root');
  }
  return absolute;
}

async function runProcess(command, args, { cwd, input, timeoutMs = 120_000 } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe','pipe','pipe'], env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} ${args.join(' ')} timed out`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: stdout.slice(-1_000_000), stderr: stderr.slice(-1_000_000) });
    });
    if (input != null) child.stdin.end(input); else child.stdin.end();
  });
}

export async function assertGitRepo(repoRoot) {
  const result = await runProcess('git', ['rev-parse','--show-toplevel'], { cwd: repoRoot, timeoutMs: 5000 });
  if (result.code !== 0) throw new Error(`Configured root is not a git worktree: ${result.stderr.trim()}`);
  const actual = path.resolve(result.stdout.trim());
  if (actual !== path.resolve(repoRoot)) throw new Error(`Configured repo root ${repoRoot} does not match git root ${actual}`);
  return actual;
}

export async function readRepoFile(repoRoot, filePath, { maxBytes = MAX_READ_BYTES } = {}) {
  const absolute = resolveRepoPath(repoRoot, filePath);
  const entry = await lstat(absolute);
  if (entry.isSymbolicLink()) throw new Error('Symbolic-link reads are not allowed');
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error('Requested path is not a file');
  if (info.size > maxBytes) throw new Error(`File is ${info.size} bytes; limit is ${maxBytes}`);
  return await readFile(absolute, 'utf8');
}

async function* walk(root, current = root) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) yield* walk(root, absolute);
    else if (entry.isFile()) yield absolute;
  }
}

export async function searchRepo(repoRoot, query, { isRegex = false, maxResults = 50 } = {}) {
  if (!query) throw new Error('query is required');
  const matcher = isRegex ? new RegExp(query, 'i') : null;
  const needle = query.toLowerCase();
  const results = [];
  for await (const absolute of walk(path.resolve(repoRoot))) {
    if (results.length >= Math.min(maxResults, MAX_SEARCH_RESULTS)) break;
    const ext = path.extname(absolute).toLowerCase();
    if (ext && !TEXT_EXTENSIONS.has(ext) && !path.basename(absolute).startsWith('.env')) continue;
    let info;
    try { info = await stat(absolute); } catch { continue; }
    if (info.size > 1_000_000) continue;
    let content;
    try { content = await readFile(absolute, 'utf8'); } catch { continue; }
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const matched = matcher ? matcher.test(line) : line.toLowerCase().includes(needle);
      if (matched) {
        results.push({ path: path.relative(repoRoot, absolute), line: index + 1, text: line.slice(0, 500) });
        if (results.length >= Math.min(maxResults, MAX_SEARCH_RESULTS)) break;
      }
    }
  }
  return results;
}

function validatePatch(patchText) {
  if (!patchText || typeof patchText !== 'string') throw new Error('patch is required');
  if (patchText.length > 500_000) throw new Error('patch exceeds the 500 KB safety limit');
  for (const line of patchText.split(/\r?\n/)) {
    if (!line.startsWith('+++ ') && !line.startsWith('--- ')) continue;
    const rawPath = line.slice(4).split('\t',1)[0].trim();
    if (rawPath === '/dev/null') continue;
    if (path.isAbsolute(rawPath)) throw new Error('Patch contains an absolute path');
    const normalized = rawPath.replace(/^(?:a|b)\//,'');
    if (/(?:^|\/)\.\.(?:\/|$)/.test(normalized)) throw new Error('Patch contains a parent-directory path');
    if (normalized === '.git' || normalized.startsWith('.git/')) throw new Error('Patch may not modify git metadata');
  }
}

export async function applyPatch(repoRoot, patchText) {
  await assertGitRepo(repoRoot);
  validatePatch(patchText);
  const check = await runProcess('git', ['apply','--check','--whitespace=nowarn','-'], { cwd: repoRoot, input: patchText, timeoutMs: 10_000 });
  if (check.code !== 0) throw new Error(`Patch check failed:\n${check.stderr || check.stdout}`);
  const applied = await runProcess('git', ['apply','--whitespace=nowarn','-'], { cwd: repoRoot, input: patchText, timeoutMs: 10_000 });
  if (applied.code !== 0) throw new Error(`Patch apply failed:\n${applied.stderr || applied.stdout}`);
  return await gitDiff(repoRoot);
}

export async function gitStatus(repoRoot) {
  await assertGitRepo(repoRoot);
  const result = await runProcess('git', ['status','--short','--branch'], { cwd: repoRoot, timeoutMs: 5000 });
  if (result.code !== 0) throw new Error(result.stderr || 'git status failed');
  return result.stdout;
}

export async function gitDiff(repoRoot) {
  await assertGitRepo(repoRoot);
  const result = await runProcess('git', ['diff','--no-ext-diff','--no-color'], { cwd: repoRoot, timeoutMs: 10_000 });
  if (result.code !== 0) throw new Error(result.stderr || 'git diff failed');
  return result.stdout;
}

export async function runNpmScript(repoRoot, scriptName, { timeoutMs = 120_000 } = {}) {
  await assertGitRepo(repoRoot);
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  if (!packageJson.scripts?.[scriptName]) throw new Error(`npm script not found: ${scriptName}`);
  const allowed = /^(?:check(?::|$)|test(?::|$)|lint(?::|$)|audit(?::|$)|build:install$)/;
  if (!allowed.test(scriptName)) throw new Error(`npm script is outside the dev-tool verification allowlist: ${scriptName}`);
  const result = await runProcess('npm', ['run', scriptName], { cwd: repoRoot, timeoutMs: Math.min(Math.max(timeoutMs, 1000), 600_000) });
  return result;
}

export async function repoExists(repoRoot, filePath) {
  try { await access(resolveRepoPath(repoRoot, filePath)); return true; } catch { return false; }
}

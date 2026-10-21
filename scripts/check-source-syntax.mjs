import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function syntaxTargets(files) {
  return [...new Set(files.map(file => file.replaceAll('\\', '/')))]
    .filter(file => /^(?:public|functions|lib|scripts|server|cloudflare|tools|examples)\//.test(file)
      && /\.(?:[cm]?js)$/.test(file)
      && !/(?:^|\/)(?:vendor|node_modules|dist|build)\//.test(file))
    .sort();
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tracked = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (tracked.error || tracked.status !== 0) throw tracked.error || new Error(tracked.stderr);
  const files = syntaxTargets(tracked.stdout.split('\0')).filter(file => existsSync(path.join(root, file)));
  const failures = [];
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      await new Promise(resolve => {
        const child = spawn(process.execPath, ['--check', file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
        let detail = '';
        child.stdout.on('data', data => { detail += data; });
        child.stderr.on('data', data => { detail += data; });
        child.once('error', error => { failures.push({ file, detail: String(error) }); resolve(); });
        child.once('exit', code => { if (code !== 0) failures.push({ file, detail }); resolve(); });
      });
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failures.length) {
    for (const { file, detail } of failures) process.stderr.write(`${file}\n${detail}\n`);
    process.exitCode = 1;
  } else {
    // Stable server entrypoints select an immutable shipping runtime. Retain the
    // existing release-aware syntax gate as well as the current source scan.
    await import('./check-canonical-server-syntax.mjs');
  }
  console.log(JSON.stringify({ ok: failures.length === 0, sourceFiles: files.length, failures: failures.length, generatedVendorExcluded: true }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

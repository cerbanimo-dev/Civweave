import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isRender = process.env.RENDER === 'true';

if (isRender) {
  console.log('[Commonweave] Public gateway mode: Gateway fast start, serving packaged assets immediately.');
  console.log('[Commonweave] Optional Transformers.js and MiniLM verification is deferred to build/release checks.');
} else {
  console.log('[Commonweave] Local campus mode: fast start, checking staged optional model assets.');
  await run(path.join(root, 'scripts', 'stage-transformers-assets.mjs'));
  await run(path.join(root, 'scripts', 'ensure-minilm-model.mjs'));
}

function run(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env: process.env,
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`${path.basename(scriptPath)} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

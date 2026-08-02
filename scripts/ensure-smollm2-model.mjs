import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relativeModelPath = 'public/app/models/smollm2-360m-instruct/onnx/model_q4f16.onnx';
const modelPath = path.join(root, relativeModelPath);
const expectedBytes = 272_737_275;
const minimumBytes = 250_000_000;
const expectedOid = 'cc63370efc2aca6d5307518b85162777132cc5b8d68eeb8154ea9b5fce09ad46';
const soft = process.argv.includes('--soft');
const checkOnly = process.argv.includes('--check');
const skipPull = process.env.COMMONWEAVE_SKIP_LFS_PULL === '1' || process.env.CI === 'true';

async function inspect() {
  try {
    const info = await stat(modelPath);
    const handle = await open(modelPath, 'r');
    const preview = Buffer.alloc(Math.min(256, info.size));
    await handle.read(preview, 0, preview.length, 0);
    await handle.close();
    const head = preview.toString('utf8');
    const pointer = head.startsWith('version https://git-lfs.github.com/spec/v1');
    return {
      exists: true,
      bytes: info.size,
      pointer,
      expectedPointer: pointer && head.includes(`oid sha256:${expectedOid}`) && head.includes(`size ${expectedBytes}`),
      ready: !pointer && info.size >= minimumBytes,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, bytes: 0, pointer: false, expectedPointer: false, ready: false };
    throw error;
  }
}

function runGit(args) {
  return spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function guidance(reason) {
  return [
    `[Commonweave] SmolLM2 graph is ${reason}.`,
    'Run:',
    `  git lfs pull --include="${relativeModelPath}"`,
    `  git lfs checkout "${relativeModelPath}"`,
  ].join('\n');
}

async function main() {
  const before = await inspect();
  if (before.ready) {
    console.log(`[Commonweave] SmolLM2 graph ready: ${before.bytes.toLocaleString()} bytes.`);
    return;
  }

  const reason = before.pointer
    ? `still a Git LFS pointer (${before.bytes} bytes)`
    : before.exists
      ? `undersized (${before.bytes} bytes)`
      : 'missing';

  if (checkOnly || skipPull) {
    const message = guidance(reason);
    if (soft || skipPull) {
      console.warn(message);
      return;
    }
    throw new Error(message);
  }

  const version = runGit(['lfs', 'version']);
  if (version.status !== 0) {
    const message = `${guidance(reason)}\nGit LFS is not available on this machine.`;
    if (soft) {
      console.warn(message);
      return;
    }
    throw new Error(message);
  }

  console.log('[Commonweave] Materializing the SmolLM2 graph from Git LFS…');
  const pull = runGit(['lfs', 'pull', `--include=${relativeModelPath}`, '--exclude=']);
  if (pull.status !== 0) {
    const message = `${guidance(reason)}\n${String(pull.stderr || pull.stdout || 'git lfs pull failed').trim()}`;
    if (soft) {
      console.warn(message);
      return;
    }
    throw new Error(message);
  }

  const checkout = runGit(['lfs', 'checkout', relativeModelPath]);
  if (checkout.status !== 0) {
    const message = `${guidance(reason)}\n${String(checkout.stderr || checkout.stdout || 'git lfs checkout failed').trim()}`;
    if (soft) {
      console.warn(message);
      return;
    }
    throw new Error(message);
  }

  const after = await inspect();
  if (!after.ready) {
    const message = guidance(after.pointer ? `still a Git LFS pointer (${after.bytes} bytes)` : `not materialized (${after.bytes} bytes)`);
    if (soft) {
      console.warn(message);
      return;
    }
    throw new Error(message);
  }

  console.log(`[Commonweave] SmolLM2 graph materialized: ${after.bytes.toLocaleString()} bytes.`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});

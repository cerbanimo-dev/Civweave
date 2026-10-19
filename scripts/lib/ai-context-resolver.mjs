import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ROOT_REAL = realpathSync(REPO_ROOT);
const REGISTRY_PATHS = Object.freeze({
  dev: 'docs/agent-workspaces/registry.json',
  runtime: 'public/app/ai-workflows/manifest.json',
});
const HEADINGS = Object.freeze(['## Inputs', '## Procedure', '## Outputs', '## Acceptance', '## Next']);
const ID = /^[a-z][a-z0-9-]{1,63}$/;

export function safeRepoPath(path) {
  if (typeof path !== 'string' || !/^[a-zA-Z0-9._/-]+$/.test(path) ||
      path.startsWith('/') || path.includes('//') ||
      path.split('/').some(part => part === '.' || part === '..' || part === '')) {
    throw new Error('Unsafe repository-relative path: ' + String(path));
  }
  const absolute = resolve(REPO_ROOT, path);
  if (!absolute.startsWith(resolve(REPO_ROOT) + sep)) throw new Error('Path escapes repository root: ' + path);
  const real = realpathSync(absolute);
  if (!real.startsWith(ROOT_REAL + sep)) throw new Error('Symlink escapes repository root: ' + path);
  return real;
}

function readText(path) { return readFileSync(safeRepoPath(path), 'utf8'); }
function uniqueIds(items, where) {
  if (!Array.isArray(items) || !items.length) throw new Error(where + ' must contain entries');
  const seen = new Set();
  for (const item of items) {
    if (!ID.test(item?.id || '')) throw new Error('Invalid ID in ' + where);
    if (seen.has(item.id)) throw new Error('Duplicate ID ' + item.id + ' in ' + where);
    seen.add(item.id);
  }
}
function checkContext(path, stage = false) {
  if (typeof path !== 'string' || !path.endsWith('/CONTEXT.md')) throw new Error('Context must point to CONTEXT.md');
  const text = readText(path);
  if (!text.startsWith('# ')) throw new Error('Missing title in ' + path);
  if (stage) {
    for (const heading of HEADINGS) {
      if (!text.split('\n').some(line => line.trim() === heading)) throw new Error('Missing ' + heading + ' in ' + path);
    }
  }
  return text;
}
export function readRegistry(kind) {
  const path = REGISTRY_PATHS[kind];
  if (!path) throw new Error('Unknown context kind: ' + String(kind));
  return JSON.parse(readText(path));
}
export function validateRegistry(kind, registry = readRegistry(kind)) {
  const isDev = kind === 'dev';
  if (!REGISTRY_PATHS[kind]) throw new Error('Unknown context kind');
  if (registry.schema !== (isDev ? 'civweave.agent-workspaces.v1' : 'civweave.ai-workflow-pack.v1')) {
    throw new Error('Unrecognized schema for ' + kind);
  }
  if (!isDev && (registry.runtimeEnabled !== false || registry.status !== 'pilot-contract-only')) {
    throw new Error('Runtime workflow pack may not be enabled by metadata alone');
  }
  if (!Array.isArray(registry.authorityFiles) || !registry.authorityFiles.length) throw new Error('Missing authority references');
  for (const authority of registry.authorityFiles) readText(authority);
  const groups = isDev ? registry.workspaces : registry.workflows;
  uniqueIds(groups, kind + ' groups');
  for (const group of groups) {
    if (!isDev) {
      if (!ID.test(group.owner || '')) throw new Error('Invalid runtime owner for ' + group.id);
      readText(group.canonicalOwner);
    }
    checkContext(group.context);
    uniqueIds(group.stages, group.id + ' stages');
    for (const [index, stage] of group.stages.entries()) {
      if (!['agent', 'ai', 'deterministic', 'human'].includes(stage.executor) || (isDev && stage.executor !== 'agent')) {
        throw new Error('Invalid executor for ' + group.id + '/' + stage.id);
      }
      if (!Array.isArray(stage.produces) || !stage.produces.length || stage.produces.some(p => typeof p !== 'string' || !/^[a-z0-9][a-z0-9.-]+\.(md|json)$/.test(p))) {
        throw new Error('Invalid stage outputs for ' + group.id + '/' + stage.id);
      }
      const text = checkContext(stage.context, true);
      const expected = group.stages[index + 1]?.id || 'complete';
      if (!text.includes('Next stage: ' + expected)) throw new Error('Incorrect stage handoff for ' + group.id + '/' + stage.id);
    }
  }
  return { kind, count: groups.length, stages: groups.reduce((n, g) => n + g.stages.length, 0) };
}
export function buildPacket(kind, groupId, stageId) {
  const registry = readRegistry(kind);
  validateRegistry(kind, registry);
  const group = (kind === 'dev' ? registry.workspaces : registry.workflows).find(x => x.id === groupId);
  if (!group) throw new Error('Unknown workspace: ' + groupId);
  const stage = group.stages.find(x => x.id === stageId);
  if (!stage) throw new Error('Unknown stage: ' + stageId);
  const instructions = checkContext(stage.context, true);
  return {
    schema: 'civweave.context-packet.v1',
    kind,
    workspace: groupId,
    stage: stageId,
    executor: stage.executor,
    authorityFiles: registry.authorityFiles,
    groupContextPath: group.context,
    stageContextPath: stage.context,
    instructions,
    sha256: createHash('sha256').update(instructions).digest('hex'),
    expectedOutputs: stage.produces,
    nextStage: group.stages[group.stages.indexOf(stage) + 1]?.id || null,
    runtimeEnabled: kind === 'runtime' ? false : undefined,
  };
}

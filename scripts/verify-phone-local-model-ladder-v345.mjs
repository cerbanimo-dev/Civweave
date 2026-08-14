import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'public/app/local-ai/model-registry-v266.js');
const source = fs.readFileSync(registryPath, 'utf8');
const events = [];
const context = {
  globalThis: {},
  CustomEvent: class CustomEvent { constructor(type, init={}) { this.type = type; this.detail = init.detail; } },
  dispatchEvent(event) { events.push(event); },
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: registryPath });

const registry = context.CivweaveLocalModelRegistryV266;
if (!registry) throw new Error('Local model registry did not initialize.');

const ids = registry.installable().map(model => model.id);
const expected = [
  'smollm2-135m-instruct-q8-wasm',
  'smollm2-360m-instruct-q4f16',
  'qwen3-0.6b-q4f16',
];
for (const id of expected) {
  if (!ids.includes(id)) throw new Error(`Missing phone ladder model: ${id}`);
}

const positions = expected.map(id => ids.indexOf(id));
if (!(positions[0] < positions[1] && positions[1] < positions[2])) {
  throw new Error(`Phone ladder order is wrong: ${positions.join(', ')}`);
}

const middle = registry.byId('smollm2-360m-instruct-q4f16');
if (middle.hidden || middle.sidecar || middle.chatSelectable === false) {
  throw new Error('SmolLM2 360M must remain a normal user-selectable download.');
}
if (middle.fallbackIds?.length) throw new Error('SmolLM2 360M must not be wired as an automatic fallback.');
if (middle.estimatedBytes < 250_000_000 || middle.estimatedBytes > 300_000_000) {
  throw new Error(`Unexpected SmolLM2 360M package size: ${middle.estimatedBytes}`);
}
if (middle.repo !== 'onnx-community/SmolLM2-360M-Instruct-ONNX') {
  throw new Error(`Unexpected SmolLM2 360M repo: ${middle.repo}`);
}
if (!middle.artifacts.some(item => item.path === 'onnx/model_q4f16.onnx' && item.required)) {
  throw new Error('SmolLM2 360M q4f16 graph is not required by the download manifest.');
}

console.log('phone local-model ladder verified');

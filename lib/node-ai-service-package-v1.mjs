import path from 'node:path';
import { pathToFileURL } from 'node:url';

function clean(value, label, max = 500) {
  const text = String(value ?? '').trim().slice(0, max);
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

export async function loadNodeAiServicePackage({ modulePath, manifest, ledger, env = process.env } = {}) {
  const configured = clean(modulePath, 'modulePath', 4000);
  if (!manifest?.nodeId || !Array.isArray(manifest.services)) throw new TypeError('A node AI service manifest is required.');
  if (!ledger) throw new TypeError('ledger is required.');
  if (/^https?:\/\//i.test(configured)) throw new RangeError('NODE_AI_SERVICE_PACKAGE_MODULE must point to a local module, not a remote URL.');
  const resolved = configured.startsWith('file:') ? configured : pathToFileURL(path.resolve(configured)).href;
  const imported = await import(resolved);
  const factory = imported.createNodeAiServicePackage || imported.default;
  const servicePackage = typeof factory === 'function'
    ? await factory({ manifest, ledger, env })
    : factory;
  if (!servicePackage || typeof servicePackage !== 'object' || Array.isArray(servicePackage)) throw new TypeError('Node AI service package must export an object or factory.');
  const handlers = servicePackage.services;
  if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) throw new TypeError('Node AI service package must expose a services object.');
  const advertised = new Set(manifest.services.map(service => service.id));
  const normalized = {};
  for (const [serviceId, handler] of Object.entries(handlers)) {
    const id = clean(serviceId, 'serviceId', 120);
    if (!advertised.has(id)) throw new RangeError(`Service package implements unadvertised service ${id}.`);
    if (!handler || typeof handler.quote !== 'function' || typeof handler.execute !== 'function') throw new TypeError(`Service ${id} must expose quote() and execute().`);
    normalized[id] = handler;
  }
  if (!Object.keys(normalized).length) throw new TypeError('Node AI service package must implement at least one advertised service.');
  return Object.freeze({
    id: clean(servicePackage.id || path.basename(configured), 'package.id', 180),
    version: String(servicePackage.version || '0').trim().slice(0, 80),
    modulePath: configured,
    services: Object.freeze(normalized),
    metadata: servicePackage.metadata && typeof servicePackage.metadata === 'object' ? structuredClone(servicePackage.metadata) : {}
  });
}

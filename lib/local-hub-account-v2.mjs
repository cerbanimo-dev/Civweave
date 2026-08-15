import { createLocalHubAccountStore as createBaseStore, LOCAL_HUB_ACCOUNT_SCHEMA, LOCAL_HUB_ACCOUNT_POLICY } from './local-hub-account-v1.mjs';

export { LOCAL_HUB_ACCOUNT_SCHEMA, LOCAL_HUB_ACCOUNT_POLICY };

// v1 accepts an injectable clock but uses its return value in both numeric time
// arithmetic and the ISO timestamp helper. Give it one value that safely supports
// both call sites so deterministic tests and production Date.now() share the same path.
function clockValue(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value)) throw new TypeError('Local Hub account clock must return a finite millisecond timestamp.');
  const tick = () => value;
  tick.valueOf = () => value;
  tick.toString = () => String(value);
  tick[Symbol.toPrimitive] = () => value;
  return tick;
}

export function createLocalHubAccountStore(options = {}) {
  const sourceNow = typeof options.now === 'function' ? options.now : () => Date.now();
  return createBaseStore({
    ...options,
    now: () => clockValue(sourceNow()),
  });
}

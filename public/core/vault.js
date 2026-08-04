const VAULT_KEY = 'commonweave.encrypted-ai-vault.v1';
let sessionConfig = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytesToBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const base64ToBytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

function normalize(config = {}) {
  const providers = Array.isArray(config.providers) ? config.providers : [];
  return {
    schema: 'commonweave.ai-vault.v1',
    activeProvider: config.activeProvider || providers.find(provider => provider.enabled !== false)?.id || null,
    antigravityEnabled: Boolean(config.antigravityEnabled),
    providers: providers.map(provider => ({
      id: provider.id || crypto.randomUUID(),
      name: String(provider.name || provider.type || 'AI source').trim(),
      type: provider.type || 'openai-compatible',
      endpoint: String(provider.endpoint || '').trim(),
      model: String(provider.model || '').trim(),
      apiKey: String(provider.apiKey || '').trim(),
      enabled: provider.enabled !== false,
      research: Boolean(provider.research)
    }))
  };
}

async function deriveKey(passphrase, salt, usage) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

export function setSession(config) {
  sessionConfig = normalize(config);
  window.dispatchEvent(new CustomEvent('commonweave:vault', { detail: publicConfig() }));
  return publicConfig();
}

export function getConfig() {
  return sessionConfig ? structuredClone(sessionConfig) : null;
}

export function publicConfig() {
  if (!sessionConfig) return { unlocked: false, activeProvider: null, antigravityEnabled: false, providers: [] };
  return {
    unlocked: true,
    activeProvider: sessionConfig.activeProvider,
    antigravityEnabled: sessionConfig.antigravityEnabled,
    providers: sessionConfig.providers.map(({ apiKey, ...provider }) => ({ ...provider, hasKey: Boolean(apiKey) }))
  };
}

export function lock() {
  sessionConfig = null;
  window.dispatchEvent(new CustomEvent('commonweave:vault', { detail: publicConfig() }));
}

export async function remember(config, passphrase) {
  if (String(passphrase || '').length < 8) throw new Error('Use a passphrase of at least eight characters.');
  const normalized = normalize(config);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ['encrypt']);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(normalized)));
  localStorage.setItem(VAULT_KEY, JSON.stringify({
    schema: 'commonweave.encrypted-ai-vault.v1',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(cipher)
  }));
  return setSession(normalized);
}

export async function unlock(passphrase) {
  const stored = JSON.parse(localStorage.getItem(VAULT_KEY) || 'null');
  if (!stored) throw new Error('No encrypted AI vault is stored on this device.');
  try {
    const salt = base64ToBytes(stored.salt);
    const iv = base64ToBytes(stored.iv);
    const key = await deriveKey(passphrase, salt, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(stored.cipher));
    return setSession(JSON.parse(decoder.decode(plain)));
  } catch {
    throw new Error('The vault could not be unlocked. Check the passphrase.');
  }
}

export function hasRememberedVault() {
  return Boolean(localStorage.getItem(VAULT_KEY));
}

export function forgetRememberedVault() {
  localStorage.removeItem(VAULT_KEY);
  lock();
}

export function activeProvider({ research = false } = {}) {
  if (!sessionConfig) return null;
  if (research && sessionConfig.antigravityEnabled) {
    const antigravity = sessionConfig.providers.find(provider => provider.enabled && (provider.type === 'antigravity' || provider.research));
    if (antigravity) return structuredClone(antigravity);
  }
  return structuredClone(sessionConfig.providers.find(provider => provider.enabled && provider.id === sessionConfig.activeProvider) || sessionConfig.providers.find(provider => provider.enabled) || null);
}

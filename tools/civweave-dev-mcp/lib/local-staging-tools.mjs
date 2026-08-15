import { JSON_OBJECT, textResult } from './tool-utils.mjs';

function loopbackOrigin(value) {
  const url = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Local staging origin must use HTTP(S).');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())) {
    throw new Error(`Local staging origin must remain on loopback, not ${url.hostname}.`);
  }
  if (url.username || url.password) throw new Error('Local staging origin cannot contain credentials.');
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.origin;
}

export function registerLocalStagingTools(add, config) {
  add({
    name: 'dev.local_staging_status',
    title: 'Local staging status',
    description: 'Check the configured loopback Civweave staging server and confirm that it reports staging production isolation. Read-only and does not start, stop, or mutate the local server.',
    inputSchema: JSON_OBJECT,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const origin = loopbackOrigin(config.localStagingOrigin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await config.fetchImpl(`${origin}/api/health`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const health = await response.json().catch(() => ({}));
      const isolated = Boolean(
        response.ok
        && health?.service === 'civweave-cloudflare-pages'
        && health?.environment === 'staging'
        && health?.productionIsolation === true
      );
      return textResult({
        origin,
        reachable: response.ok,
        isolated,
        status: response.status,
        environment: health?.environment || null,
        productionIsolation: health?.productionIsolation === true,
        stagingSyntheticHub: health?.stagingSyntheticHub === true,
        appUrl: `${origin}/app/`,
        health,
      });
    } catch (error) {
      return textResult({
        origin,
        reachable: false,
        isolated: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
        appUrl: `${origin}/app/`,
      });
    } finally {
      clearTimeout(timer);
    }
  });
}

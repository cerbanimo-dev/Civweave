export function localStagingWranglerArgs({ host = '127.0.0.1', port = 8788 } = {}) {
  return [
    '--yes',
    'wrangler@4',
    'pages',
    'dev',
    'public',
    '--compatibility-date',
    '2026-08-04',
    '--compatibility-flag',
    'nodejs_compat',
    '--binding',
    'CIVWEAVE_ENVIRONMENT=staging',
    '--binding',
    'CIVWEAVE_LOCAL_STAGING=1',
    '--binding',
    'CIVWEAVE_PRODUCTION_ISOLATION=true',
    '--ip',
    host,
    '--port',
    String(port),
  ];
}

export function localStagingSpawnSpec({ platform = process.platform, env = process.env, npxArgs = [] } = {}) {
  const args = [...npxArgs];
  if (platform === 'win32') {
    return {
      command: env.ComSpec || env.COMSPEC || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx', ...args],
    };
  }
  return { command: 'npx', args };
}

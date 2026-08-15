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

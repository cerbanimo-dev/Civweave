import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = (await fsp.readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const release = path.join(root, 'releases', version, 'server');
const runtimePath = path.join(root, '.civweave-canonical-gateway.entry.mjs');
let source = await fsp.readFile(path.join(release, 'server-gateway-v131.mjs'), 'utf8');
const wrapperSource = "const sourcePath = path.join(rootDir, 'server-gateway-v131-base.mjs');";
if (!source.includes(wrapperSource)) throw new Error('Canonical gateway runtime no longer exposes its base-wrapper boundary.');
source = source.replace(wrapperSource, `const sourcePath = path.join(rootDir, 'releases', '${version}', 'server', 'server-gateway-v131-base.mjs');`);
const readNeedle = "let source = (await fsp.readFile(sourcePath, 'utf8')).replace(/^\\uFEFF/, '').replace(/\\r\\n?/g, '\\n');";
if (!source.includes(readNeedle)) throw new Error('Canonical gateway runtime no longer exposes its source materialization hook.');
const canonicalInstallHook = "const canonicalInstallOrigin='https://civweave.pages.dev';\nconst releaseUrlNeedle=\"\\\\nconst CIVWEAVE_RELEASE_URL = process.env.CIVWEAVE_RELEASE_URL || 'https://github.com/cerbanimo-dev/Civweave/archive/refs/heads/main.zip';\";\nif(!source.includes(releaseUrlNeedle))throw new Error('Canonical install origin patch could not find gateway release URL.');\nsource=source.replace(releaseUrlNeedle,releaseUrlNeedle+\"\\\\nconst CIVWEAVE_INSTALL_ORIGIN = process.env.CIVWEAVE_INSTALL_ORIGIN || '\"+canonicalInstallOrigin+\"';\");\nconst releasePacketNeedle='appUrl: `${root}/`, installUrl: `${root}/`';\nif(!source.includes(releasePacketNeedle))throw new Error('Canonical install origin patch could not find release packet install URL.');\nsource=source.replace(releasePacketNeedle,'appUrl: CIVWEAVE_INSTALL_ORIGIN, installUrl: CIVWEAVE_INSTALL_ORIGIN');\nconst runtimeGateNeedle=\"installUrl:requestOrigin(req,url)+'/'\";\nif(!source.includes(runtimeGateNeedle))throw new Error('Canonical install origin patch could not find installed-runtime install URL.');\nsource=source.replace(runtimeGateNeedle,'installUrl:CIVWEAVE_INSTALL_ORIGIN');\nconst configNeedle='appUrl: null, installUrl: `${requestOrigin(req, url)}/`';\nif(!source.includes(configNeedle))throw new Error('Canonical install origin patch could not find public config install URL.');\nsource=source.replace(configNeedle,'appUrl: CIVWEAVE_INSTALL_ORIGIN, installUrl: CIVWEAVE_INSTALL_ORIGIN');";
source = source.replace(readNeedle, readNeedle + '\n' + canonicalInstallHook + '\n' + `source = source.replace("const sourcePath = path.join(rootDir, 'server.mjs');", "const sourcePath = path.join(rootDir, 'releases', '${version}', 'server', 'server.mjs');");`);
await fsp.writeFile(runtimePath, source, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?canonical=${encodeURIComponent(version)}-gateway`);
} finally {
  setTimeout(() => fsp.unlink(runtimePath).catch(() => {}), 1000).unref?.();
}

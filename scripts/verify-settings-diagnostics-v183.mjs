import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [delegation,additive,installer,pwa,boundary,campus]=await Promise.all([
  read('public/app/settings-delegation-v175.js'),
  read('public/service-worker-v156.js'),
  read('public/install-v130.js'),
  read('public/app/pwa-v130.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.html')
]);

new Function(delegation);
new Function(additive.replace(/^importScripts\([^\n]+\);/m,''));
new Function(installer);
new Function(pwa);
new Function(boundary);

for(const token of [
  "VERSION='183.0-settings-diagnostics-log-level'",
  "LOGGER_VERSION='1.0.6-settings-log-v183'",
  "LEVEL_KEY='commonweave.log-level'",
  "BUFFER_KEY='commonweave.log-buffer.v1'",
  "off:0,error:1,warn:2,info:3,debug:4,trace:5",
  "new URLSearchParams(location.search).get('cwlog')",
  'MAX_ENTRIES=240',
  'function sanitize(',
  "'[redacted]'",
  "PerformanceObserver.supportedEntryTypes?.includes('longtask')",
  "warn('performance','event-loop-stall'",
  "warn('performance','long-task'",
  "addEventListener('unhandledrejection'",
  "addEventListener('error'",
  "id='cw-log-dock'",
  'data-cw-log-copy',
  'data-cw-log-download',
  'data-cw-log-clear',
  'data-cw-log-off',
  "logger.info('settings','open-invoke'",
  "logger.info('settings','open-return'",
  "logger.debug('settings','open-first-paint'",
  "logger.error('settings','open-threw'",
  "result&&typeof result.then==='function'",
  'globalThis.CommonweaveLogV183=logger'
])assert(delegation.includes(token),`Settings diagnostics missing ${token}`);

for(const forbidden of [
  'open().catch(',
  '\nmigrateLegacyAI();\n',
  'pipeline(',
  'new Worker(',
  'showModal('
])assert(!delegation.includes(forbidden),`Settings diagnostics retained forbidden behavior: ${forbidden}`);

assert(delegation.includes("/(?:api.?key|secret|token|authorization|password|credential)/i"),'Secret-redaction key pattern is missing.');
assert(delegation.includes("localStorage.setItem(BUFFER_KEY"),'Diagnostic buffer is not persisted for post-freeze recovery.');
assert(delegation.includes("document.addEventListener('click'"),'Launcher capture logging is missing.');
assert(delegation.includes("event.stopImmediatePropagation()"),'Logged launcher path is not the single capture owner.');

for(const token of [
  "EXTENSION_VERSION='working-campus-additions-v183-settings-diagnostics'",
  "SETTINGS_LOG_REVISION='settings-log-level-v183'",
  "logLevelKey:'commonweave.log-level'",
  "logBufferKey:'commonweave.log-buffer.v1'",
  'persistentLogBuffer:true',
  'redactsSecrets:true'
])assert(additive.includes(token),`Additive package missing ${token}`);

for(const token of [
  "ADDITIONS_REVISION='working-campus-additions-v183-settings-diagnostics'",
  "AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r45'",
  '?cwlog=debug'
])assert(installer.includes(token),`Installer diagnostics delivery missing ${token}`);

for(const token of [
  'working-campus-additions-v183-settings-diagnostics',
  'diagnostic log update downloaded',
  'settings diagnostics active'
])assert(pwa.includes(token),`PWA diagnostics marker missing ${token}`);

for(const token of [
  "ADDITIONS_VERSION='v183-settings-diagnostics'",
  "SETTINGS_LOG_REVISION='v183-reusable-log-levels'",
  "logLevelKey:'commonweave.log-level'",
  "logBufferKey:'commonweave.log-buffer.v1'",
  "diagnosticQueryParameter:'cwlog'"
])assert(boundary.includes(token),`Install boundary diagnostics marker missing ${token}`);

for(const token of [
  'working-campus-v183-v106',
  'data-settings-diagnostics="cwlog"',
  'data-open-unified-ai-settings',
  'settings-v183-logs-v106'
])assert(campus.includes(token),`Working Campus diagnostics route missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  revision:'v183-settings-diagnostics-log-level',
  defaultLevel:'warn',
  levels:['off','error','warn','info','debug','trace'],
  enableQuery:'?cwlog=debug',
  persistentBuffer:true,
  maxEntries:240,
  redactsSecrets:true,
  longTaskObserver:true,
  eventLoopStallWatch:true,
  logDockAtDebug:true,
  providerRuntimeOnOpen:false,
  singleLauncherCapture:true,
  synchronousOpenPromiseBugRemoved:true
},null,2));

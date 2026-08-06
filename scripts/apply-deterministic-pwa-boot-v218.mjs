import fs from 'node:fs/promises';

const BOOT_KEY = 'commonweave.install-boundary.boot.v218';
const REVISION = 'deterministic-boot-v218';

async function replaceIn(file, transforms) {
  let source = await fs.readFile(file, 'utf8');
  for (const [from, to] of transforms) {
    if (!source.includes(from)) throw new Error(`${file} missing expected source: ${from.slice(0, 80)}`);
    source = source.replace(from, to);
  }
  await fs.writeFile(file, source);
}

await replaceIn('public/app/manifest.webmanifest', [
  ['"start_url": "/app/?system=commonweave&version=1.0.6"', '"start_url": "/app/?system=commonweave&installed=1&version=1.0.6"'],
  ['"url":"/app/?system=commonweave"', '"url":"/app/?system=commonweave&installed=1"'],
  ['"url":"/app/?system=living-school"', '"url":"/app/?system=living-school&installed=1"'],
  ['"url":"/app/?system=cerbanimo"', '"url":"/app/?system=cerbanimo&installed=1"'],
  ['"url":"/app/?system=fellowfare"', '"url":"/app/?system=fellowfare&installed=1"'],
  ['"url":"/app/?system=anarchadia"', '"url":"/app/?system=anarchadia&installed=1"']
]);

await replaceIn('public/install-v130.js', [
  ["const ENTRY = '/app/installed-entry-v146.html?system=commonweave';", "const ENTRY = '/app/?system=commonweave&installed=1';"],
  ["const WORKER_SCRIPT_REVISION = 'stable-entry-v217';", `const WORKER_SCRIPT_REVISION = '${REVISION}';`]
]);

await replaceIn('public/index.html', [
  ['revision=stable-entry-v217', `revision=${REVISION}`]
]);

const launcher = `(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='${BOOT_KEY}';
const installedDisplay=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(\`(display-mode: \${mode})\`).matches);
const legacyEntry=/^\\/app\\/installed-entry-v146(?:\\.html)?$/.test(location.pathname);
const explicitInstalled=params.get('installed')==='1'||legacyEntry;
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
if(explicitInstalled||installedDisplay())sessionStorage.setItem(BOOT_KEY,'1');
const bootGranted=()=>sessionStorage.getItem(BOOT_KEY)==='1';
if(!installedDisplay()&&!bootGranted()&&!localDeveloper()){const installer=new URL('/',location.origin);installer.searchParams.set('install','required');location.replace(installer.href);return}
const requested=params.get('system')||params.get('target')||'commonweave',aliases={hub:'commonweave',cabinet:'commonweave',cabinets:'commonweave',cabinetonly:'commonweave',lite:'commonweave'},system=aliases[requested]||requested;
const sites={commonweave:'/app/working-campus-v156.html','living-school':'/app/cabinets/living-school/index.html?cabinet=1',cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',fellowfare:'/app/fellowfare-cabinet-v144.html?cabinet=1',anarchadia:'/app/anarchadia-console-v139.html?cabinet=1'};
const destination=new URL(sites[system]||sites.commonweave,location.origin);destination.searchParams.set('installed','1');if(localDeveloper())destination.searchParams.set('developer','1');location.replace(destination.href);
})();
`;
await fs.writeFile('public/app/installed-entry-v146.js', launcher);

await replaceIn('public/app/install-boundary-v146.js', [
  ["const INSTALLER='/';", `const INSTALLER='/';\nconst BOOT_KEY='${BOOT_KEY}';`],
  ["function embedded(){try{return window.top!==window.self}catch{return true}}\nfunction allowed(){return installedDisplay()||developer()||embedded()}", "function embedded(){try{return window.top!==window.self}catch{return true}}\nfunction explicitInstalled(){if(params.get('installed')==='1'){sessionStorage.setItem(BOOT_KEY,'1');return true}return sessionStorage.getItem(BOOT_KEY)==='1'}\nfunction allowed(){return installedDisplay()||explicitInstalled()||developer()||embedded()}"],
  ["globalThis.CommonweaveInstallBoundaryV146={version:'1.0.6',allowed,installedDisplay,developer,embedded,installerUrl,installAdditions", "globalThis.CommonweaveInstallBoundaryV146={version:'1.0.6',allowed,installedDisplay,explicitInstalled,developer,embedded,installerUrl,installAdditions"]
]);

await replaceIn('public/app/fullscreen-family-v104.html', [
  ["location.replace(sites[id]||sites.commonweave)", "const destination=new URL(sites[id]||sites.commonweave,location.origin);destination.searchParams.set('installed','1');location.replace(destination.href)"]
]);

const verifier = `import assert from 'node:assert/strict';\nimport fs from 'node:fs/promises';\nconst manifest=JSON.parse(await fs.readFile('public/app/manifest.webmanifest','utf8'));\nassert(manifest.start_url.includes('installed=1'),'manifest start_url lacks installed marker');\nfor(const shortcut of manifest.shortcuts)assert(shortcut.url.includes('installed=1'),'shortcut lacks installed marker: '+shortcut.name);\nconst launcher=await fs.readFile('public/app/installed-entry-v146.js','utf8');\nassert(launcher.includes('${BOOT_KEY}'),'launcher lacks boot grant');\nassert(launcher.includes("commonweave:'/app/working-campus-v156.html'"),'launcher still uses fullscreen relay');\nassert(launcher.includes("destination.searchParams.set('installed','1')"),'launcher drops installed marker');\nconst boundary=await fs.readFile('public/app/install-boundary-v146.js','utf8');\nassert(boundary.includes('function explicitInstalled()'),'boundary lacks explicit installed grant');\nassert(boundary.includes('${BOOT_KEY}'),'boundary boot key mismatch');\nconst installer=await fs.readFile('public/install-v130.js','utf8');\nassert(installer.includes("const ENTRY = '/app/?system=commonweave&installed=1';"),'installer still opens legacy entry');\nassert(installer.includes("const WORKER_SCRIPT_REVISION = '${REVISION}';"),'installer worker revision mismatch');\nconst index=await fs.readFile('public/index.html','utf8');\nassert(index.includes('revision=${REVISION}'),'homepage worker bootstrap mismatch');\nconsole.log('Deterministic PWA boot v218 verified.');\n`;
await fs.writeFile('scripts/verify-deterministic-pwa-boot-v218.mjs', verifier);

console.log('Applied deterministic PWA boot v218.');

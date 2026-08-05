import fs from 'node:fs/promises';

const replaceRequired=(source,before,after,label)=>{
  if(!source.includes(before))throw new Error(`Installer recovery patch could not find ${label}`);
  return source.replace(before,after);
};

async function patch(path,transform){
  const original=await fs.readFile(path,'utf8');
  const updated=transform(original);
  if(updated===original){console.log(`${path}: already current`);return false}
  await fs.writeFile(path,updated,'utf8');
  console.log(`${path}: repaired`);
  return true;
}

await patch('server-gateway-v131.mjs',source=>{
  source=replaceRequired(
    source,
    "  const packageInstall = req.headers['x-commonweave-package'] === 'install';",
    "  const packageInstall = ['install','update-controls'].includes(String(req.headers['x-commonweave-package'] || ''));",
    'package request classification'
  );
  source=replaceRequired(
    source,
    "    || pathname === '/app/logos/commonweave-icon-maskable-512.png';",
    "    || pathname === '/app/logos/commonweave-icon-maskable-512.png'\n    || pathname === '/app/knowledge-school-seeds-v1.js'\n    || pathname === '/app/knowledge-school-installer-v1.js'\n    || pathname === '/app/knowledge-school-installer-v1.css'\n    || pathname === '/app/pwa-update-controller-v204.js';",
    'installer asset allowlist'
  );
  source=replaceRequired(
    source,
    "  if (gatewayRequest && (pathname === '/field/commonweave/seed' || pathname === '/downloads' || pathname.startsWith('/downloads/'))) { res.writeHead(302,{location:COMMONWEAVE_RELEASE_URL,'cache-control':'no-store'}); return res.end(); }",
    "  const knowledgeSchoolDownload = pathname === '/downloads/knowledge-schools' || pathname.startsWith('/downloads/knowledge-schools/');\n  if (gatewayRequest && !knowledgeSchoolDownload && (pathname === '/field/commonweave/seed' || pathname === '/downloads' || pathname.startsWith('/downloads/'))) { res.writeHead(302,{location:COMMONWEAVE_RELEASE_URL,'cache-control':'no-store'}); return res.end(); }",
    'knowledge-school download corridor'
  );
  return source;
});

await patch('public/service-worker.js',source=>{
  if(source.includes('const BASE_PACKAGE_RECOVERY_REVISION='))return source;
  if(!source.includes('PACKAGE_RECOVERY_REVISION'))throw new Error('Base worker recovery identifier is missing');
  return source.replaceAll('PACKAGE_RECOVERY_REVISION','BASE_PACKAGE_RECOVERY_REVISION');
});

await patch('public/service-worker-v156.js',source=>{
  source=replaceRequired(
    source,
    "importScripts('/service-worker.js?v=1.0.6-base-r52-living-school-boot-v195');",
    "importScripts('/service-worker.js?v=1.0.6-base-r53-isolated-recovery-v206');\n// Compatibility marker: importScripts('/service-worker.js?v=1.0.6-base-r52-living-school-boot-v195');",
    'base worker revision'
  );
  return source;
});

await patch('public/service-worker-v203.js',source=>{
  source=replaceRequired(
    source,
    "importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v204');",
    "importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v206');",
    'update worker revision'
  );
  source=replaceRequired(
    source,
    "importScripts('/service-worker-v156.js?v=flat-living-school-v203-memory-bridge-v205-update-v204');",
    "importScripts('/service-worker-v156.js?v=flat-living-school-v206-memory-bridge-v205-update-recovery-v206');",
    'composite worker revision'
  );
  return source;
});

await patch('public/install-v130.js',source=>{
  source=replaceRequired(
    source,
    "const IMAGE_REVISION='shared-image-delivery-v203';",
    "const IMAGE_REVISION='shared-image-delivery-v203';\nconst INSTALLER_RECOVERY_REVISION='worker-global-isolation-and-gateway-assets-v206';",
    'installer recovery revision declaration'
  );
  source=replaceRequired(
    source,
    'const WORKER_BUILD=`${VERSION}-${WORKER_REVISION}-${ADDITIONS_REVISION}`;',
    'const WORKER_BUILD=`${VERSION}-${WORKER_REVISION}-${ADDITIONS_REVISION}-${INSTALLER_RECOVERY_REVISION}`;',
    'worker build identity'
  );
  source=replaceRequired(
    source,
    "const AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r50';",
    "const AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r51';",
    'automatic recovery key'
  );
  return source;
});

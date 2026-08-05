import fs from 'node:fs/promises';

const replaceRequired=(source,before,after,label)=>{
  if(!source.includes(before))throw new Error(`Installer recovery CI alignment could not find ${label}`);
  return source.replace(before,after);
};

async function patch(path,transform){
  const original=await fs.readFile(path,'utf8');
  const updated=transform(original);
  if(updated===original){console.log(`${path}: already aligned`);return}
  await fs.writeFile(path,updated,'utf8');
  console.log(`${path}: aligned`);
}

await patch('public/service-worker-v203.js',source=>{
  const desired="importScripts('/service-worker-v156.js?v=flat-living-school-v203-memory-bridge-v205-update-recovery-v206');";
  if(source.includes(desired))return source;
  return replaceRequired(
    source,
    "importScripts('/service-worker-v156.js?v=flat-living-school-v206-memory-bridge-v205-update-recovery-v206');",
    desired,
    'Living School worker lineage'
  );
});

await patch('scripts/verify-knowledge-school-seeds-v1.mjs',source=>{
  const currentRevision="UPDATE_REVISION='visible-update-library-preservation-v206-worker-global-isolation-gateway-assets'";
  if(!source.includes(currentRevision))source=replaceRequired(
    source,
    "UPDATE_REVISION='visible-update-library-preservation-v204'",
    currentRevision,
    'knowledge installer update revision'
  );
  const currentWrapper="importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v206')";
  if(!source.includes(currentWrapper))source=replaceRequired(
    source,
    "importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v204')",
    currentWrapper,
    'knowledge update worker wrapper revision'
  );
  return source;
});

await patch('scripts/verify-service-worker-evaluation-v189.mjs',source=>{
  const isolatedAssertions="assert(baseWorker.includes(\"const BASE_PACKAGE_RECOVERY_REVISION=\"),'Base worker recovery binding is not isolated.');\nassert(!baseWorker.includes(\"const PACKAGE_RECOVERY_REVISION=\"),'Base worker still exports the generic collision-prone recovery binding.');\nassert(additiveWorker.includes(\"const PACKAGE_RECOVERY_REVISION=\"),'Additive worker recovery binding is missing from its isolation closure.');";
  if(!source.includes(isolatedAssertions))source=replaceRequired(
    source,
    "assert(baseWorker.includes(\"const PACKAGE_RECOVERY_REVISION=\"),'Base worker no longer exposes the collision fixture.');\nassert(additiveWorker.includes(\"const PACKAGE_RECOVERY_REVISION=\"),'Additive worker no longer exposes the collision fixture.');",
    isolatedAssertions,
    'worker recovery-binding assertions'
  );
  if(!source.includes('/base-r(?:48|49|50|51|52|53)-/'))source=replaceRequired(
    source,
    "/base-r(?:48|49|50|51|52)-/",
    "/base-r(?:48|49|50|51|52|53)-/",
    'recognized base worker revisions'
  );
  const currentRegression="const collisionBase=baseWorker.replaceAll('BASE_PACKAGE_RECOVERY_REVISION','PACKAGE_RECOVERY_REVISION');\nconst regression=evaluate(`${collisionBase}\\n${unscopedBody}`,'unscoped-service-worker.js');";
  if(!source.includes(currentRegression))source=replaceRequired(
    source,
    "const regression=evaluate(`${baseWorker}\\n${unscopedBody}`,'unscoped-service-worker.js');",
    currentRegression,
    'explicit collision regression fixture'
  );
  return source;
});

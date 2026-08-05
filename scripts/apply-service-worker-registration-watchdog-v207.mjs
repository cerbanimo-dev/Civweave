import fs from 'node:fs/promises';

const block=(...lines)=>lines.join('\n');

const replaceRequired=(source,before,after,label)=>{
  if(!source.includes(before))throw new Error(`Watchdog patch could not find ${label}`);
  return source.replace(before,after);
};

const replacePattern=(source,pattern,after,label)=>{
  if(!pattern.test(source))throw new Error(`Watchdog patch could not find ${label}`);
  return source.replace(pattern,after);
};

async function patch(path,transform){
  const original=await fs.readFile(path,'utf8');
  const updated=transform(original);
  if(updated===original){console.log(`${path}: already patched`);return false}
  await fs.writeFile(path,updated,'utf8');
  console.log(`${path}: patched`);
  return true;
}

await patch('public/install-v130.js',source=>{
  source=replaceRequired(
    source,
    "const UPDATE_REVISION='visible-update-library-preservation-v206-worker-global-isolation-gateway-assets';",
    "const UPDATE_REVISION='visible-update-library-preservation-v207-registration-watchdog';",
    'installer update revision'
  );
  source=replaceRequired(
    source,
    "const PREPARE_TIMEOUT_MS=180000;\nconst AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r51';\nconst PREVIOUS_AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r48';\nconst EARLIER_AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r47';",
    "const PREPARE_TIMEOUT_MS=180000;\nconst REGISTRATION_TIMEOUT_MS=15000;\nconst UPDATE_TIMEOUT_MS=15000;\nconst REGISTRATION_QUERY_TIMEOUT_MS=6000;\nconst AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r52';\nconst PREVIOUS_AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r51';\nconst EARLIER_AUTO_RESET_KEY='commonweave.device-package.auto-reset.v106-r48';\nconst WATCHDOG_RECOVERY_KEY='commonweave.device-package.registration-watchdog.v107-r1';",
    'installer watchdog constants'
  );
  source=replaceRequired(source,"let activeWorker=null;","let activeWorker=null;\nlet recovering=false;",'installer recovery state');
  source=replaceRequired(
    source,
    "const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));",
    block(
      "const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));",
      "function withTimeout(promise,timeoutMs,message,phase='operation'){",
      "  return new Promise((resolve,reject)=>{",
      "    let settled=false;",
      "    const timer=setTimeout(()=>{",
      "      if(settled)return;",
      "      settled=true;",
      "      const error=new Error(message);",
      "      error.name='CommonweavePackageTimeoutError';",
      "      error.code='COMMONWEAVE_PACKAGE_TIMEOUT';",
      "      error.phase=phase;",
      "      reject(error);",
      "    },timeoutMs);",
      "    Promise.resolve(promise).then(value=>{",
      "      if(settled)return;",
      "      settled=true;",
      "      clearTimeout(timer);",
      "      resolve(value);",
      "    },error=>{",
      "      if(settled)return;",
      "      settled=true;",
      "      clearTimeout(timer);",
      "      reject(error);",
      "    });",
      "  });",
      "}"
    ),
    'installer timeout helper'
  );
  source=replacePattern(
    source,
    /async function resetDevicePackage\(\)\{[\s\S]*?\n\}\nfunction askWorker/,
    block(
      "async function resetDevicePackage(){",
      "  recovering=true;",
      "  help('Removing the incomplete app package while preserving your saved knowledge library…');",
      "  sessionStorage.removeItem(WATCHDOG_RECOVERY_KEY);",
      "  sessionStorage.removeItem(AUTO_RESET_KEY);",
      "  await migrateKnowledgeCache();",
      "  if('serviceWorker'in navigator){",
      "    const regs=await withTimeout(navigator.serviceWorker.getRegistrations(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the registered app packages.','registration lookup').catch(()=>[]);",
      "    await Promise.allSettled(regs.filter(rootScope).map(reg=>withTimeout(reg.unregister(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not release the old app package.','registration cleanup')));",
      "  }",
      "  await clearPackageCaches();",
      "  registration=null;",
      "  activeWorker=null;",
      "  await pause(350);",
      "  const next=new URL(location.href);",
      "  next.searchParams.set('package-reset',Date.now().toString(36));",
      "  location.replace(next.href);",
      "}",
      "async function recoverStalledRegistration(error){",
      "  const phase=error?.phase||'service-worker registration';",
      "  if(sessionStorage.getItem(WATCHDOG_RECOVERY_KEY)==='1'){",
      "    throw new Error((error?.message||'Chrome stalled while preparing the app package.')+' Automatic recovery already ran once. Use Reset app package and retry.');",
      "  }",
      "  sessionStorage.setItem(WATCHDOG_RECOVERY_KEY,'1');",
      "  recovering=true;",
      "  help('Chrome stalled during '+phase+'. Preserving your knowledge library and rebuilding the app registration once…');",
      "  await migrateKnowledgeCache();",
      "  const regs=await withTimeout(navigator.serviceWorker.getRegistrations(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return registrations during recovery.','registration recovery lookup').catch(()=>[]);",
      "  await Promise.allSettled(regs.filter(rootScope).map(reg=>withTimeout(reg.unregister(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not release a stale registration.','registration recovery cleanup')));",
      "  await clearPackageCaches();",
      "  registration=null;",
      "  activeWorker=null;",
      "  await pause(300);",
      "  const next=new URL(location.href);",
      "  next.searchParams.set('registration-recovery',Date.now().toString(36));",
      "  location.replace(next.href);",
      "  const navigation=new Error('Reloading after stalled '+phase+'.');",
      "  navigation.code='COMMONWEAVE_RECOVERY_RELOAD';",
      "  navigation.phase=phase;",
      "  throw navigation;",
      "}",
      "function askWorker"
    ),
    'installer reset and automatic recovery functions'
  );
  source=replacePattern(
    source,
    /async function waitForCurrentWorker\(timeoutMs=PREPARE_TIMEOUT_MS\)\{[\s\S]*?\n\}\nasync function confirmReady/,
    block(
      "async function waitForCurrentWorker(timeoutMs=PREPARE_TIMEOUT_MS){",
      "  const started=Date.now();",
      "  while(Date.now()-started<timeoutMs){",
      "    registration=await withTimeout(navigator.serviceWorker.getRegistration('/'),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the current service-worker registration.','registration lookup');",
      "    const candidate=registration?.waiting||registration?.installing;",
      "    if(registration?.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});",
      "    if(candidate?.state==='installed')candidate.postMessage({type:'SKIP_WAITING'});",
      "    if(registration?.active?.state==='activated'&&workerMatches(registration.active)){",
      "      activeWorker=registration.active;",
      "      return activeWorker;",
      "    }",
      "    const state=candidate?.state||registration?.active?.state||'registering';",
      "    help('Preparing Commonweave · '+state+'…');",
      "    if(candidate?.state==='redundant')throw new Error('The browser rejected the updated app package.');",
      "    await pause(180);",
      "  }",
      "  const error=new Error('Package preparation timed out.');",
      "  error.code='COMMONWEAVE_PACKAGE_TIMEOUT';",
      "  error.phase='worker activation';",
      "  throw error;",
      "}",
      "async function confirmReady"
    ),
    'installer worker activation wait'
  );
  source=replacePattern(
    source,
    /async function preparePackage\(options=\{\}\)\{[\s\S]*?\n\}\nasync function installOrOpen/,
    block(
      "async function preparePackage(options={}){",
      "  if(preparing)return;",
      "  preparing=true;",
      "  recovering=false;",
      "  packageReady=false;",
      "  packageError=null;",
      "  showPackage({});",
      "  guidance();",
      "  const updateButton=$('#check-update');",
      "  if(updateButton){updateButton.disabled=true;updateButton.textContent=options.manual?'Checking release…':'Checking package…'}",
      "  try{",
      "    if(!('serviceWorker'in navigator))throw new Error('This browser does not support service workers.');",
      "    const migrated=await migrateKnowledgeCache();",
      "    if(migrated)help('Preserved '+migrated+' staged knowledge-school file'+(migrated===1?'':'s')+' before updating the app package…');",
      "    const existing=await withTimeout(navigator.serviceWorker.getRegistration('/'),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the existing app registration.','registration lookup');",
      "    const exactActive=existing?.active?.state==='activated'&&workerMatches(existing.active);",
      "    const exactCandidate=[existing?.waiting,existing?.installing].find(workerMatches);",
      "    let worker=null;",
      "    if(exactActive){",
      "      registration=existing;",
      "      activeWorker=existing.active;",
      "      worker=activeWorker;",
      "      help('Using the current Commonweave package registration…');",
      "    }else{",
      "      if(exactCandidate){",
      "        registration=existing;",
      "        if(existing.waiting||exactCandidate.state==='installed')exactCandidate.postMessage({type:'SKIP_WAITING'});",
      "      }else{",
      "        if(existing&&sessionStorage.getItem(AUTO_RESET_KEY)!=='1'){",
      "          sessionStorage.setItem(AUTO_RESET_KEY,'1');",
      "          await withTimeout(existing.unregister(),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not release the outdated app registration.','registration cleanup');",
      "          await clearPackageCaches();",
      "          await pause(250);",
      "        }",
      "        help('Registering the Commonweave app package…');",
      "        registration=await withTimeout(",
      "          navigator.serviceWorker.register(WORKER_URL,{scope:'/',updateViaCache:'none'}),",
      "          REGISTRATION_TIMEOUT_MS,",
      "          'Chrome did not finish registering the Commonweave app package.',",
      "          'service-worker registration'",
      "        );",
      "        const returnedWorker=registration?.waiting||registration?.installing||registration?.active;",
      "        if(!workerMatches(returnedWorker)){",
      "          help('Refreshing the Commonweave worker package…');",
      "          await withTimeout(",
      "            registration.update(),",
      "            UPDATE_TIMEOUT_MS,",
      "            'Chrome did not finish checking the Commonweave worker package.',",
      "            'service-worker update'",
      "          );",
      "        }",
      "      }",
      "      worker=await waitForCurrentWorker();",
      "    }",
      "    await withTimeout(",
      "      navigator.serviceWorker.ready,",
      "      REGISTRATION_TIMEOUT_MS,",
      "      'Chrome did not finish activating the Commonweave app package.',",
      "      'service-worker readiness'",
      "    );",
      "    await confirmReady(worker);",
      "    sessionStorage.removeItem(WATCHDOG_RECOVERY_KEY);",
      "    if(options.manual)help('Commonweave is updated and ready. Your saved knowledge library was preserved.');",
      "  }catch(error){",
      "    if(error?.code==='COMMONWEAVE_PACKAGE_TIMEOUT'){",
      "      try{await recoverStalledRegistration(error)}catch(recoveryError){",
      "        if(recoveryError?.code!=='COMMONWEAVE_RECOVERY_RELOAD')failPackage(recoveryError);",
      "      }",
      "    }else if(error?.code!=='COMMONWEAVE_RECOVERY_RELOAD')failPackage(error);",
      "  }finally{",
      "    preparing=false;",
      "    if(updateButton){updateButton.disabled=false;updateButton.textContent='Check release'}",
      "    if(!recovering)guidance();",
      "  }",
      "}",
      "async function installOrOpen"
    ),
    'installer package preparation state machine'
  );
  return source;
});

await patch('public/app/pwa-update-controller-v204.js',source=>{
  source=replaceRequired(source,"const VERSION='v204-visible-update-library-preservation';","const VERSION='v207-registration-watchdog';",'installed updater version');
  source=replaceRequired(source,"const AUTO_CHECK_MS=6*60*60*1000;","const AUTO_CHECK_MS=6*60*60*1000;\nconst UPDATE_TIMEOUT_MS=15000;\nconst REGISTRATION_QUERY_TIMEOUT_MS=6000;",'installed updater timeout constants');
  source=replaceRequired(
    source,
    "const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));",
    block(
      "const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));",
      "function withTimeout(promise,timeoutMs,message){",
      "  return new Promise((resolve,reject)=>{",
      "    let settled=false;",
      "    const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(message))},timeoutMs);",
      "    Promise.resolve(promise).then(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)},error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)});",
      "  });",
      "}"
    ),
    'installed updater timeout helper'
  );
  source=replaceRequired(
    source,
    "registration=registration||await navigator.serviceWorker.getRegistration('/');",
    "registration=registration||await withTimeout(navigator.serviceWorker.getRegistration('/'),REGISTRATION_QUERY_TIMEOUT_MS,'Chrome did not return the Commonweave update registration.');",
    'installed updater registration lookup'
  );
  source=replaceRequired(
    source,
    "await registration.update();",
    "await withTimeout(registration.update(),UPDATE_TIMEOUT_MS,'Chrome did not finish the update check. Open the updater to repair the package.');",
    'installed updater update deadline'
  );
  source=replaceRequired(
    source,
    "sessionStorage.removeItem(RELOAD_KEY);\n    setState('Update check failed','error',error?.message||String(error));",
    "sessionStorage.removeItem(RELOAD_KEY);\n    repairMode=true;\n    setState('Open updater','error',error?.message||String(error));",
    'installed updater timeout recovery state'
  );
  return source;
});

await patch('public/app/install-boundary-v146.js',source=>{
  source=replaceRequired(source,"const ADDITIONS_VERSION='v204-visible-update-library-preservation';","const ADDITIONS_VERSION='v207-registration-watchdog';\n// Compatibility marker: ADDITIONS_VERSION='v204-visible-update-library-preservation'",'install boundary cache revision');
  source=replaceRequired(source,"const FAST_CORE_COMPATIBILITY_REVISION='v204-v106-visible-update-library-preservation';","const FAST_CORE_COMPATIBILITY_REVISION='v207-v106-registration-watchdog';",'install boundary fast core revision');
  source=replaceRequired(source,"const PACKAGE_RECOVERY_REVISION='v204-update-button-knowledge-cache-migration';","const PACKAGE_RECOVERY_REVISION='v207-registration-update-deadlines';",'install boundary recovery revision');
  source=replaceRequired(source,"pwaUpdateRevision:'v204-visible-update-library-preservation'","pwaUpdateRevision:'v207-registration-watchdog'",'install boundary update metadata');
  return source;
});

await patch('public/service-worker-update-v204.js',source=>{
  source=replaceRequired(source,"const CACHE='cwupdate-visible-v204';","const CACHE='cwupdate-visible-v207';",'update lane cache');
  source=replaceRequired(source,"v=visible-update-library-v204","v=visible-update-library-v207-registration-watchdog",'update lane request revision');
  source=replaceRequired(source,"version:'v204-visible-update-library-preservation'","version:'v207-registration-watchdog'",'update lane metadata');
  return source;
});

await patch('public/service-worker-v203.js',source=>{
  source=replaceRequired(source,"importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v206');","importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v207-registration-watchdog');",'update lane import revision');
  source=replaceRequired(source,"importScripts('/service-worker-v156.js?v=flat-living-school-v203-memory-bridge-v205-update-recovery-v206');","importScripts('/service-worker-v156.js?v=flat-living-school-v203-memory-bridge-v205-update-recovery-v207-registration-watchdog');",'base worker import revision');
  return source;
});

await patch('public/index.html',source=>replaceRequired(
  source,
  '<script src="/install-v130.js?v=1.0.6-update-library-v204"></script>',
  '<script src="/install-v130.js?v=1.0.6-registration-watchdog-v207"></script>',
  'installer script cache buster'
));

await patch('scripts/verify-knowledge-school-seeds-v1.mjs',source=>{
  source=replaceRequired(source,"UPDATE_REVISION='visible-update-library-preservation-v206-worker-global-isolation-gateway-assets'","UPDATE_REVISION='visible-update-library-preservation-v207-registration-watchdog'",'knowledge verifier installer revision');
  source=replaceRequired(source,"pwaUpdateRevision:'v204-visible-update-library-preservation'","pwaUpdateRevision:'v207-registration-watchdog'",'knowledge verifier updater metadata');
  source=replaceRequired(source,"'registration.update()'","'withTimeout(registration.update()'",'knowledge verifier updater deadline');
  source=replaceRequired(source,"const CACHE='cwupdate-visible-v204'","const CACHE='cwupdate-visible-v207'",'knowledge verifier update cache');
  source=replaceRequired(source,"importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v206')","importScripts('/service-worker-update-v204.js?v=visible-update-library-preservation-v207-registration-watchdog')",'knowledge verifier wrapper import');
  source=replaceRequired(source,"appUpdateControl: 'visible-v204'","appUpdateControl: 'visible-v207-registration-watchdog'",'knowledge verifier report revision');
  return source;
});

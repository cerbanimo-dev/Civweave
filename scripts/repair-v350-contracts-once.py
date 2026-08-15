from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace(path, old, new, count=-1):
    text = read(path)
    found = text.count(old)
    if found == 0:
        raise SystemExit(f"{path}: missing expected text: {old[:120]!r}")
    if count >= 0 and found != count:
        raise SystemExit(f"{path}: expected {count} matches, found {found}: {old[:120]!r}")
    write(path, text.replace(old, new, count if count >= 0 else -1))


# Canonical V350 surface regains the notification API used by queued work.
p = "public/app/guide-chat-surface-v350.js"
marker = "function switchGuide(system,options={}){"
notify = """function notify(system,text,options={}){
  const value=clean(text,6000);if(!SYSTEMS.includes(system)||!value)return false;
  const thread=readThread(system);thread.messages=Array.isArray(thread.messages)?thread.messages:[];thread.messages.push({id:uid('msg'),at:now(),role:'assistant',guide:system,responderSystem:system,text:value,notification:true});if(system!==activeSystem||!openState)thread.unread=Math.min(99,Number(thread.unread||0)+1);writeThread(system,thread);
  if(options.open)return open({guide:system,focus:false});if(root&&activeSystem===system)render();emitState();return true
}
"""
replace(p, marker, notify + marker, 1)
replace(p, "activeWindow,submitText,render,ensureRoot,ensureLauncher", "activeWindow,notify,submitText,render,ensureRoot,ensureLauncher", 1)

# Identity handoff must target the actual owner, not the V242 loader.
p = "public/app/guide-identity-integrity-v216.js"
replace(p, "const VERSION='1.0.2-guide-identity-integrity-v216-v242-only';", "const VERSION='1.0.162-guide-identity-integrity-v216-v350';", 1)
replace(p, "queueMicrotask(()=>globalThis.CivweaveGuideWorkspaceV242?.switchWindow?.(system,{open:false}));", "queueMicrotask(()=>globalThis.CivweaveGuideChatSurfaceV350?.switchGuide?.(system,{open:false}));", 1)
replace(p, "canonicalChatOwner:'guide-workspace-v242'", "canonicalChatOwner:'guide-chat-surface-v350'", 1)

# Family loader now opens/waits on V350 directly.
p = "public/app/family-ai-loader-v105.js"
text = read(p).replace("const VERSION='1.0.124-headless-canonical-chat-r52-economic-value-v1-settings-gateway-v317';", "const VERSION='1.0.162-headless-canonical-chat-v350-economic-value-v1-settings-gateway-v317';", 1)
start = text.find("function canonicalChatApi(){")
end = text.find("async function openChat", start)
if start < 0 or end < 0:
    raise SystemExit("family-ai-loader: canonical chat block not found")
block = """function canonicalChatApi(){
  const api=globalThis.CivweaveGuideChatSurfaceV350;
  return api?.canonicalOwner&&typeof api.open==='function'?api:null;
}
function openCanonical(target,prefill=''){
  const owner=canonicalChatApi();if(!owner)return null;return owner.open({guide:target,prefill,focus:true});
}
function waitForCanonicalChat(timeout=1600){
  if(canonicalChatApi())return Promise.resolve(true);
  return new Promise(resolve=>{
    let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('civweave:guide-chat-ready',ready);resolve(value)};
    const ready=()=>finish(true),timer=setTimeout(()=>finish(Boolean(canonicalChatApi())),timeout);
    addEventListener('civweave:guide-chat-ready',ready,{once:true});
  });
}
"""
text = text[:start] + block + text[end:]
text = text.replace("addEventListener('civweave:guide-workspace-ready',patchHeader);", "addEventListener('civweave:guide-chat-ready',patchHeader);", 1)
text = text.replace("canonicalChatOwner:'guide-workspace-v242'", "canonicalChatOwner:'guide-chat-surface-v350'", 1)
if "CivweaveGuideWorkspaceV242" in text:
    raise SystemExit("family-ai-loader still references V242 runtime")
write(p, text)

# Weaveling Hub readiness follows V350 directly.
p = "public/app/weaveling-hub-v233.js"
text = read(p).replace("const VERSION='1.0.1-canonical-guide-workspace';", "const VERSION='1.0.162-canonical-guide-chat-v350';", 1).replace("const REVISION='weaveling-hub-v233-canonical-guide-workspace';", "const REVISION='weaveling-hub-v233-canonical-guide-chat-v350';", 1)
start = text.find("function canonicalChatReady(){")
end = text.find("function mount(){", start)
if start < 0 or end < 0:
    raise SystemExit("weaveling-hub: canonical chat readiness block not found")
block = """function canonicalChatReady(){return Boolean(globalThis.CivweaveGuideChatSurfaceV350?.openWindow)}
function ensureSharedChat(timeout=1800){if(canonicalChatReady())return Promise.resolve(true);return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('civweave:guide-chat-ready',ready);resolve(value)},ready=()=>finish(true),timer=setTimeout(()=>finish(canonicalChatReady()),timeout);addEventListener('civweave:guide-chat-ready',ready,{once:true})})}
"""
text = text[:start] + block + text[end:]
if "CivweaveGuideWorkspaceV242" in text:
    raise SystemExit("weaveling-hub still references V242 runtime")
write(p, text)

# Unified chat decorates the single V350 surface and uses its notification API.
p = "public/app/unified-chat-system-v1.js"
text = read(p).replace("const VERSION='1.0.0-unified-chat-system-v1';", "const VERSION='1.0.162-unified-chat-system-v1-v350';", 1)
start = text.find("function activeTheme(){")
end = text.find("function memoryFolder", start)
if start < 0 or end < 0:
    raise SystemExit("unified chat activeTheme block not found")
text = text[:start] + """function activeTheme(){
  const candidate=globalThis.CivweaveGuideChatSurfaceV350?.activeWindow?.()||document.documentElement?.dataset?.civweaveSystemRoute||'civweave';
  return SYSTEMS.includes(candidate)?candidate:'civweave';
}

""" + text[end:]
start = text.find("function normalizeSurface(){")
end = text.find("function stateForLivingSchool", start)
if start < 0 or end < 0:
    raise SystemExit("unified chat normalizeSurface block not found")
text = text[:start] + """function normalizeSurface(){
  const root=document.getElementById(ROOT_ID);if(!root)return false;root.dataset.chatArchitecture='one-core-five-themes';root.dataset.memoryIsolation='five-folders';const select=root.querySelector('[data-guide-select]');if(select)select.setAttribute('aria-label','Chat themes');return true
}

""" + text[end:]
text = text.replace("globalThis.CivweavePersistentGuideChatV215?.notify?.", "globalThis.CivweaveGuideChatSurfaceV350?.notify?.")
text = text.replace("'civweave:guide-workspace-ready'", "'civweave:guide-chat-ready'")
if "CivweaveGuideWorkspaceV242" in text:
    raise SystemExit("unified chat still references V242 runtime")
write(p, text)

# Stability metadata must not advertise a retired owner.
replace("public/app/platform-stability-v159.js", "canonicalChatOwner:'guide-workspace-v242'", "canonicalChatOwner:'guide-chat-surface-v350'", 1)

# Guide identity verifier follows the ownership registry and verifies a real V350 handoff.
Path("scripts/verify-guide-identity-integrity-v216.mjs").write_text(r'''import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const exists=file=>access(path.join(root,file)).then(()=>true,()=>false);
const [identity,boundary,assistant,ownershipText]=await Promise.all([read('public/app/guide-identity-integrity-v216.js'),read('public/app/install-boundary-v146.js'),read('public/app/assistant-runtime-v141.js'),read('config/system-ownership.json')]);
const ownership=JSON.parse(ownershipText),owner=ownership.systems?.['guide-chat']?.owner;
assert.equal(owner,'public/app/guide-chat-surface-v350.js');const chat=await read(owner);
for(const source of [identity,boundary,chat])new Function(source);
for(const token of ["guide-identity-integrity-v216-v350",'Identity boundary:','requestedSystem','respondingSystem','handedOff',"Object.defineProperty(globalThis,'CivweaveAssistantV141'","identityPolicy:'selected-guide-or-receiving-guide-after-handoff'",'CivweaveGuideChatSurfaceV350?.switchGuide',"canonicalChatOwner:'guide-chat-surface-v350'"])assert(identity.includes(token),`Guide identity integrity runtime is missing ${token}`);
for(const forbidden of ['CivweaveGuideWorkspaceV242','civweave.persistent-guide-chat.v214','MutationObserver','setInterval(','Storage?.prototype','reconcilePersistentDom','migratePersistentThread'])assert(!identity.includes(forbidden),`Guide identity runtime still contains retired chat behavior: ${forbidden}`);
assert(boundary.includes("const GUIDE_WORKSPACE='/app/guide-chat-surface-v350.js'"));assert(boundary.includes("guideIdentityRevision:'v216-explicit-responder-ownership'"));assert(chat.includes("presentationOwner:'guide-chat-surface-v350'"));assert(chat.includes('switchGuide'));assert(chat.includes('canonicalOwner:true'));assert(assistant.includes("if(systemId==='civweave'&&routedSystem!=='civweave')systemId=routedSystem"));
for(const retired of ['public/app/persistent-guide-chat-v215.js','public/app/persistent-guide-viewport-v216.js'])assert.equal(await exists(retired),false,`${retired} must remain deleted.`);
const listeners=new Map(),switched=[];const addEventListener=(type,listener)=>{const rows=listeners.get(type)||[];rows.push(listener);listeners.set(type,rows)};const removeEventListener=(type,listener)=>listeners.set(type,(listeners.get(type)||[]).filter(item=>item!==listener));const dispatchEvent=event=>{for(const listener of listeners.get(event.type)||[])listener(event);return true};
const sandbox={console,URLSearchParams,location:{pathname:'/app/cabinets/living-school/index.html',search:'?system=living-school',hostname:'example.test'},document:{documentElement:{dataset:{civweaveSystemRoute:'living-school'},hasAttribute:()=>false},body:{dataset:{}}},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},addEventListener,removeEventListener,dispatchEvent,queueMicrotask:callback=>callback(),CivweaveGuideChatSurfaceV350:{switchGuide:(system,options)=>switched.push({system,open:Boolean(options?.open)})}};sandbox.globalThis=sandbox;
vm.runInNewContext(identity,sandbox,{filename:'guide-identity-integrity-v216.js'});sandbox.CivweaveAssistantV141={respond:async options=>({response:{answer:'Identity held.',choice:{system:options.systemId,nextAction:'Continue.'}},context:{guide:{system:options.systemId}},provider:'test-provider',model:'test-model'})};
const moss=await sandbox.CivweaveAssistantV141.respond({systemId:'living-school',history:[]});assert.equal(moss.respondingSystem,'living-school');assert.equal(moss.respondingGuide,'Moss');assert.equal(moss.handedOff,false);
const handedOff=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',history:[]});assert.equal(handedOff.requestedSystem,'civweave');assert.equal(handedOff.respondingSystem,'living-school');assert.equal(handedOff.respondingGuide,'Moss');assert.equal(handedOff.handedOff,true);assert.equal(switched.at(-1)?.system,'living-school');assert.equal(switched.at(-1)?.open,false);
console.log(JSON.stringify({ok:true,revision:'v216-identity-integrity-v350',canonicalChatOwner:owner,legacyChatMigration:false,documentObservers:0},null,2));
''')

# Regression verifier checks current single-surface invariants, not retired V242 gestures.
p = "scripts/verify-regression-fixes-v243.mjs"
text = read(p).replace("read('public/app/guide-workspace-v242.js'),", "read('public/app/guide-chat-surface-v350.js'),", 1)
start = text.find('assert(workspace.includes("document.addEventListener')
end = text.find("assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js')", start)
if start < 0 or end < 0:
    raise SystemExit("regression verifier old workspace block not found")
block = """assert(workspace.includes(\"presentationOwner:'guide-chat-surface-v350'\"),'V350 does not advertise canonical presentation ownership.');
assert(workspace.includes(\"root.querySelector('[data-persistent-form]').addEventListener('submit'\"),'V350 form does not own local submission.');
assert(workspace.includes('function switchGuide(')&&workspace.includes('submitText'),'V350 direct guide switch/submission APIs are missing.');
assert(workspace.includes('canonicalOwner:true'),'V350 does not advertise canonical ownership.');
assert(workspace.includes('height:100dvh'),'V350 lost mobile full-height layout.');
assert(!workspace.includes('new MutationObserver'),'V350 must not install a DOM repair observer.');
assert(!workspace.includes(\"document.addEventListener('pointerdown'\")&&!workspace.includes(\"document.addEventListener('pointerup'\"),'V350 must not install document gesture relays.');
assert(!workspace.includes('visualViewport?.addEventListener'),'V350 must not own visualViewport event repair.');
assert(!workspace.includes('CHAT_OWNER_REPAIR')&&!workspace.includes('chat-single-owner-v245.js'),'V350 resurrects a second owner.');

"""
write(p, text[:start] + block + text[end:])

# Working Campus verifier reads the canonical Settings owner, not its compatibility facade.
p = "scripts/verify-working-campus-mvp-v155.mjs"
text = read(p).replace("read('public/app/model-settings-controller-v173.js'),", "read('public/app/settings-gateway-v317.js'),", 1)
text = text.replace("\"activation:'settings-gateway-v317'\",", "\"const DEFAULTS=Object.freeze({route:'deterministic'\",", 1).replace("'Nothing probes, starts, or tests a model merely because this panel opened.'", "'Opening or saving Settings never probes or starts a model.'", 1)
write(p, text)

# Compact experience registry formatting is valid; parse it without newline dogma.
p = "scripts/verify-radio-bootstrap-priority-v267.mjs"
text = read(p).replace(r"/const SYSTEM_EXPERIENCE_SCRIPTS=\[([\s\S]*?)\n\];/", r"/const SYSTEM_EXPERIENCE_SCRIPTS=\[([\s\S]*?)\];/", 1)
text = text.replace("const entries=[...match[1].matchAll(/^\\s{2}([A-Z][A-Z0-9_]+),?\\s*$/gm)].map(item=>item[1]);", "const entries=match[1].split(',').map(item=>item.trim()).filter(item=>/^[A-Z][A-Z0-9_]+$/.test(item));", 1)
write(p, text)

# Installer branding verifier follows current day/night source while retaining regenerated PWA icon contracts.
p = "scripts/verify-installer-front-door-v1.mjs"
text = read(p)
text = text.replace("assert.ok(installerHtml.includes('<img src=\"/app/logos/civweave-pwa-192-v247.png\" alt=\"Civweave\">'),'installer header must keep the verified PNG compatibility mark directly');", "assert.ok(installerHtml.includes('<img src=\"/app/logos/civweave-day-logo.jpg\" alt=\"Civweave\">'),'installer header must use the current Civweave day logo directly');", 1)
text = text.replace("assert.ok(installerHtml.includes('<link rel=\"icon\" href=\"/app/logos/civweave-pwa-192-v247.png\" type=\"image/png\">'),'installer favicon must use the verified PNG directly');", "assert.ok(installerHtml.includes('<link rel=\"icon\" href=\"/app/logos/civweave-day-logo.jpg\" type=\"image/jpeg\">'),'installer favicon must start from the current Civweave day logo');", 1)
text = text.replace("assert.ok(brand.includes(\"const CANONICAL_LOGO='/app/logos/civweave-pwa-512-v247.png'\"),'brand layer must use the verified Civweave PNG');", "assert.ok(brand.includes(\"const DAY_LOGO='/app/logos/civweave-day-logo.jpg'\")&&brand.includes(\"const NIGHT_LOGO='/app/logos/civweave-night-logo.jpg'\")&&brand.includes('logoForLocalClock'),'brand layer must own the current local-clock day/night Civweave logo');", 1)
write(p, text)

# Recovery verifier follows the source-owned day/night logo cycle.
replace("scripts/verify-recovery-asset-lockboard-v239.mjs", "  ['Working Campus brand uses direct app icon fallback',()=>{\n    assert.match(campus,/\\/app\\/logos\\/civweave-app-icon\\.png/);\n  }],", "  ['Working Campus brand uses the current day/night Civweave source',()=>{\n    assert.match(campus,/BRAND_CYCLE_REVISION='day-night-clock-v236'/);\n    assert.match(campus,/BRAND_DAY='\\/app\\/logos\\/civweave-day-logo\\.jpg'/);\n    assert.match(campus,/BRAND_NIGHT='\\/app\\/logos\\/civweave-night-logo\\.jpg'/);\n  }],", 1)

# Topbar remains above the current V350 chat root.
p = "scripts/verify-working-campus-topbar-v243.mjs"
text = read(p).replace("read('public/app/guide-workspace-v242.js'),", "read('public/app/guide-chat-surface-v350.js'),", 1).replace("workspace.includes('z-index:2147483644!important')", "workspace.includes('z-index:2147483612')", 1)
write(p, text)

# Weaveling hub verifier follows V350 readiness/launcher ownership.
p = "scripts/verify-weaveling-hub-v233.mjs"
text = read(p).replace("read('public/app/guide-workspace-v242.js'),", "read('public/app/guide-chat-surface-v350.js'),", 1)
text = text.replace("assert(hub.includes('CivweaveGuideWorkspaceV242?.openWindow'),'Hub must recognize the canonical v242 guide workspace.');", "assert(hub.includes('CivweaveGuideChatSurfaceV350?.openWindow'),'Hub must recognize the canonical V350 guide chat.');", 1)
text = text.replace("assert(hub.includes(\"addEventListener('civweave:guide-workspace-ready'\"),'Hub must wait for the canonical workspace readiness event when necessary.');", "assert(hub.includes(\"addEventListener('civweave:guide-chat-ready'\"),'Hub must wait for the canonical V350 readiness event when necessary.');", 1)
text = text.replace("assert(workspace.includes(\"const LAUNCHER_ID='cwp215-launcher';\"),'Canonical v242 workspace launcher contract changed unexpectedly.');", "assert(workspace.includes(\"const LAUNCHER_ID='cwp215-launcher';\"),'Canonical V350 launcher contract changed unexpectedly.');", 1)
text = text.replace("assert(workspace.includes('canonicalOwner:true'),'v242 must remain the canonical guide owner.');", "assert(workspace.includes(\"presentationOwner:'guide-chat-surface-v350'\")&&workspace.includes('canonicalOwner:true'),'V350 must remain the canonical guide owner.');", 1)
text = text.replace("revision:'weaveling-hub-v233+v242-canonical-chat'", "revision:'weaveling-hub-v233+v350-canonical-chat'", 1).replace("chatOwner:'guide-workspace-v242'", "chatOwner:'guide-chat-surface-v350'", 1)
write(p, text)

# Knowledge-school verifier follows current install-boundary chat metadata.
replace("scripts/verify-knowledge-school-seeds-v1.mjs", "\"guideWorkspaceRevision:'v250-v242-canonical-owner'\"", "\"guideWorkspaceRevision:'v350-single-current-chat-surface'\"", 1)

# Installed launch already reached Working Campus; don't wait for unrelated full-load resources.
replace("scripts/browser-installer-gauntlet-v281.mjs", "await installedLaunch.waitForURL(url=>url.pathname==='/app/working-campus-v156.html',{timeout:20000});", "await installedLaunch.waitForURL(url=>url.pathname==='/app/working-campus-v156.html',{timeout:20000,waitUntil:'domcontentloaded'});", 1)

# Unified workflow verifies V350 while still syntax-checking the compatibility loader.
p = ".github/workflows/verify-unified-chat-system.yml"
text = read(p)
text = text.replace("      - 'public/app/guide-workspace-v242.js'", "      - 'public/app/guide-chat-surface-v350.js'\n      - 'public/app/guide-workspace-v242.js'")
text = text.replace("          node --check public/app/guide-workspace-v242.js", "          node --check public/app/guide-chat-surface-v350.js\n          node --check public/app/guide-workspace-v242.js", 1)
old = """          const workspace=fs.readFileSync('public/app/guide-workspace-v242.js','utf8');
          const sessions=fs.readFileSync('public/app/realm-session-integrity-v237.js','utf8');"""
new = """          const ownership=JSON.parse(fs.readFileSync('config/system-ownership.json','utf8'));
          const chatPath=ownership.systems?.['guide-chat']?.owner;
          if(chatPath!=='public/app/guide-chat-surface-v350.js')throw new Error('System ownership does not point at V350 chat');
          const chat=fs.readFileSync(chatPath,'utf8');
          const sessions=fs.readFileSync('public/app/realm-session-integrity-v237.js','utf8');"""
if old not in text:
    raise SystemExit("unified workflow owner read block not found")
text = text.replace(old, new, 1)
text = text.replace("          if(!workspace.includes(\"const ROOT_ID='cw-persistent-guide-chat-v215'\"))throw new Error('Shared workspace root missing');", "          if(!chat.includes(\"const ROOT_ID='cw-persistent-guide-chat-v215'\")||!chat.includes(\"presentationOwner:'guide-chat-surface-v350'\"))throw new Error('Canonical V350 chat surface contract missing');", 1)
write(p, text)

# Wire future V350 owner changes into the relevant specialized workflows.
for path in [
    ".github/workflows/verify-guide-identity-integrity-v216.yml",
    ".github/workflows/verify-weaveling-hub-v233.yml",
    ".github/workflows/verify-regression-fixes-v243.yml",
    ".github/workflows/verify-working-campus-topbar-v243.yml",
]:
    text = read(path)
    if "public/app/guide-chat-surface-v350.js" not in text and "public/app/guide-workspace-v242.js" in text:
        text = text.replace("      - 'public/app/guide-workspace-v242.js'", "      - 'public/app/guide-chat-surface-v350.js'\n      - 'public/app/guide-workspace-v242.js'")
        write(path, text)

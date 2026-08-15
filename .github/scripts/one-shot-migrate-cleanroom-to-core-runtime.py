from pathlib import Path

p=Path('scripts/verify-ai-settings-cleanroom-v188.mjs')
s=p.read_text()
s=s.replace("boundary:'public/app/install-boundary-v146.js',brand:","boundary:'public/app/install-boundary-v146.js',coreRuntime:'public/app/core-interface-runtime-v1.js',brand:",1)
s=s.replace("['gateway','controller','lifecycle','boundary','brand','credential']","['gateway','controller','lifecycle','boundary','coreRuntime','brand','credential']",1)
old="""assert.match(sources.boundary,/const SETTINGS_GATEWAY='\\/app\\/settings-gateway-v317\\.js'/);
const experience=sources.boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\\[([\\s\\S]*?)\\n\\];/)?.[1]||'';
assert.match(experience,/SETTINGS_GATEWAY/);
for(const forbidden of ['AI_SETTINGS_BIND_GUARD','AI_SETTINGS_REPAIR','DOCUMENT_LIFECYCLE','model-settings-controller-v173','settings-delegation-v175'])assert.ok(!experience.includes(forbidden),`Boundary eagerly includes ${forbidden}.`);"""
new="""assert.match(sources.boundary,/const CORE_INTERFACE_RUNTIME='\\/app\\/core-interface-runtime-v1\\.js'/);
assert.doesNotMatch(sources.boundary,/SYSTEM_EXPERIENCE_SCRIPTS|CANONICAL_SYSTEM_SCRIPTS/,'Install boundary must not retain system shared dependency manifests.');
const systemBoot=sources.boundary.match(/function installSystemExperienceSupport\\(\\)\\{([\\s\\S]*?)\\n\\}/)?.[1]||'';
assert.match(systemBoot,/addScript\\(CORE_INTERFACE_RUNTIME\\)/,'Five-system boot must load the core runtime.');
assert.doesNotMatch(systemBoot,/SETTINGS_GATEWAY|GUIDE_WORKSPACE|SYSTEM_RADIO_AGENT|\\.forEach\\(/,'Five-system boundary boot must not directly assemble shared owners.');
const shared=sources.coreRuntime.match(/const SHARED_BOOT_SCRIPTS=Object\\.freeze\\(\\[([\\s\\S]*?)\\n\\]\\);/)?.[1]||'';
assert.match(shared,/['\"]\\/app\\/settings-gateway-v317\\.js['\"]/,'Core runtime must assemble the canonical Settings gateway.');
for(const forbidden of ['AI_SETTINGS_BIND_GUARD','AI_SETTINGS_REPAIR','DOCUMENT_LIFECYCLE','model-settings-controller-v173','settings-delegation-v175'])assert.ok(!shared.includes(forbidden),`Core runtime eagerly includes ${forbidden}.`);
assert.doesNotMatch(sources.coreRuntime,/data-open-unified-ai-settings|addEventListener[^\\n]*\\('click'/,'Core runtime may load Settings but may not own Settings input.');"""
if old not in s:
    raise SystemExit('cleanroom boundary ownership block no longer matches current main')
p.write_text(s.replace(old,new,1))

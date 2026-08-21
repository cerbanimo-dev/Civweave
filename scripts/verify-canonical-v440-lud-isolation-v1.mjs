#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(new URL('..',import.meta.url).pathname);
const file=relative=>readFileSync(resolve(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(text,needle,label)=>assert(text.includes(needle),`${label} is missing ${needle}`);
const excludes=(text,needle,label)=>assert(!text.includes(needle),`${label} still contains ${needle}`);
const syntax=relative=>{const result=spawnSync(process.execPath,['--check',resolve(root,relative)],{encoding:'utf8'});assert(result.status===0,`${relative} failed node --check:\n${result.stderr||result.stdout}`)};

for(const path of [
  'public/app/system-routes-v227.js',
  'public/app/five-system-direct-navigation-v1.js',
  'public/app/unified-chat-system-v1.js',
  'public/app/lud-game-ui-v1.js',
  'public/service-worker-canonical-navbar-v1.js',
  'public/service-worker-legacy-home-redirect-v1.js',
  'public/service-worker-canonical-home-v1.js',
  'public/service-worker-v203.js'
])syntax(path);

const routes=file('public/app/system-routes-v227.js');
includes(routes,"const LEGACY_SHELL_PATH='/app/working-campus-v156.html'",'system route contract');
includes(routes,"const SHELL_PATH='/app/working-campus-v440.html'",'system route contract');
includes(routes,"civweave:Object.freeze({id:'civweave',label:'Civweave',pathname:SHELL_PATH",'system route contract');
includes(routes,"SERVER_AI_OUTPUT_NORMALIZER_SRC='/app/server-ai-output-normalizer-v1.js?v=1.0.0'",'system route contract');
includes(routes,'ensureServerAIOutputNormalizer();','system route contract');

const direct=file('public/app/five-system-direct-navigation-v1.js');
includes(direct,"const CANONICAL_HOME='/app/working-campus-v440.html'",'direct navigation');
includes(direct,'civweave:[CANONICAL_HOME,{}]','direct navigation');
excludes(direct,"civweave:['/app/working-campus-v156.html'",'direct navigation');

const start=file('public/app/pwa-start-v436.html');
includes(start,"civweave:['/app/working-campus-v440.html',{}]",'PWA start');
includes(start,"canonicalCampusPath:'/app/working-campus-v440.html'",'PWA start');
includes(start,"freshCampusPath:'/app/working-campus-v440.html'",'PWA start');

const legacy=file('public/service-worker-legacy-home-redirect-v1.js');
includes(legacy,"const LEGACY='/app/working-campus-v156.html'",'legacy home redirect');
includes(legacy,"const CANONICAL='/app/working-campus-v440.html'",'legacy home redirect');
includes(legacy,"request.mode!=='navigate'",'legacy home redirect');
includes(legacy,'explicit-legacy-navigation-redirect-only-no-client-reload','legacy home redirect');

const home=file('public/service-worker-canonical-home-v1.js');
includes(home,"const PATH='/app/working-campus-v440.html'",'canonical home worker');
includes(home,'exact-network-first-validated-v440-home-never-legacy-substitution','canonical home worker');
includes(home,'refused to substitute a legacy campus','canonical home worker');

const navbar=file('public/service-worker-canonical-navbar-v1.js');
includes(navbar,"const CACHE='cw-nav-canonical-v8'",'canonical navbar worker');
includes(navbar,"const OUTPUT_NORMALIZER_PATH='/app/server-ai-output-normalizer-v1.js'",'canonical navbar worker');
includes(navbar,"const MERLINITES_STYLE_PATH='/app/merlinites-shell-fix-v166.css'",'canonical navbar worker');

const sw=file('public/service-worker-v203.js');
includes(sw,"service-worker-legacy-home-redirect-v1.js?v=legacy-home-redirect-v1-v156-to-v440",'v203 worker');
includes(sw,"service-worker-canonical-home-v1.js?v=canonical-home-v1-v440-exact-owner",'v203 worker');
includes(sw,"canonical-navbar-network-first-v8-v440-home-css-isolation",'v203 worker');
includes(sw,"system-routes-v227.js?v=1.0.166-five-system-route-contract-v229-v440-home",'v203 worker');

const v440=file('public/app/working-campus-v440.html');
includes(v440,'data-build="working-campus-v440-cache-distinct-recovery"','v440 home');
includes(v440,'/app/system-routes-v227.js?v=working-campus-v440','v440 home');

const moss=file('public/app/unified-chat-system-v1.js');
includes(moss,'modules:{type:\'array\',minItems:3,maxItems:8','Moss Learning Journey schema');
includes(moss,'if(modules.length<3)','Moss Learning Journey acceptance floor');
excludes(moss,'if(modules.length<2)','Moss Learning Journey acceptance floor');

const sharedShell=file('public/app/merlinites-shell-fix-v166.css');
excludes(sharedShell,'--cw-lud-symbol','standard shell');
includes(sharedShell,'Lud symbolic HUD identity belongs to public/app/lud-game-ui-v1.js only.','standard shell');

const lud=file('public/app/lud-game-ui-v1.js');
includes(lud,"const HUD_ID='cw-lud-hud-nav'",'Lud HUD');
includes(lud,'data-lud-hud-system','Lud HUD');
includes(lud,'data:image/svg+xml;base64','Lud HUD');
includes(lud,"kind:'learning-module'",'Lud HUD');
includes(lud,"kind:'quest'",'Lud HUD');

const brand=file('public/app/civweave-brand.js');
includes(brand,"const LUD_MODE_URL='/app/lud/'",'downloads page brand runtime');
includes(brand,'function ensureLudModeLink()','downloads page brand runtime');
includes(brand,'ensureLudModeLink();','downloads page brand runtime');
includes(brand,"link.textContent='Download Lud Mode'",'downloads page brand runtime');

console.log('PASS v440 is canonical, legacy v156 migrates, Moss enforces its schema floor, Lud symbols stay in Lud HUD, and the Downloads page retains its Lud Mode link.');

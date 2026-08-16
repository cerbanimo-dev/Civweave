import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [js,css,civweaveHtml,cerbanimoHtml,topbar,routes,contract]=await Promise.all([
  read('public/app/cerbanimo-intention-landscape-v1.js'),
  read('public/app/cerbanimo-intention-landscape-v1.css'),
  read('public/app/civweave-guild-quest-v1.html'),
  read('public/app/realm-console-v140.html'),
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/system-routes-v227.js'),
  read('docs/contracts/cerbanimo-intention-landscape-v1.md')
]);

for(const token of [
  "const HOUSES=Object.freeze([",
  "id:'magenta'",
  "id:'cyan'",
  "id:'amber'",
  "id:'purple'",
  "id:'pearl'",
  "'living-school':{id:'living-school'",
  "cerbanimo:{id:'cerbanimo'",
  "fellowfare:{id:'fellowfare'",
  "solid:'#aeea57'",
  "solid:'#e85dff'",
  "solid:'#efb452'",
  "const TIER_COLORS=Object.freeze({guild:'#8af5d2',quest:'#e85dff',map:'#efb452'})",
  "const HOUSE_VOTE_KEY='civweave.anarchadia.pending-proposals.v1'",
  "schema:'civweave.house-change-proposal.v1'",
  "dispatchEvent(new CustomEvent('civweave:anarchadia-proposal-requested'",
  "const GOVERNANCE_DB='civweave-anarchadia-governance-v145'",
  "const DIRECTORY_ENDPOINT='/api/hub-map-nodes'",
  "const DIRECTORY_CACHE_KEY='civweave.hub-map.directory.v1'",
  "const HOST_SELECTION_KEY='civweave.host-node.selection.v1'",
  'function normalizeDirectoryGuild',
  'function discoveredGuilds()',
  'async function refreshDirectory()',
  'fetch(DIRECTORY_ENDPOINT',
  'function questsFor(guild)',
  'function carousel(items,selected,kind)',
  'function mapPanel(quest)',
  'function voteBadges(task)',
  'function isCivweave()',
  'return isCivweave()',
  'Guilds · live + saved',
  'No Guild data available',
  'Citizen slot',
  'Patron slot',
  "addEventListener('civweave:hub-map-directory'",
  'Choose a Guild',
  'Choose a Quest',
  'Quest Map',
  'Guilds → Quests → Quest Maps',
  "globalThis.CivweaveGuildQuestTrackerV1=api",
  "const MESH_KEY='federation-finder.mesh-nodes.v1'",
  "const INTENTIONS_KEY='civweave.intentions.v127'"
])assert(js.includes(token),`Guild Quest runtime missing ${token}`);

for(const forbidden of [
  "name:'Your Civweave Guild'",
  "description:'Your local Civweave Guild.",
  "||`Guild ${index+1}`",
  "||`Shared Quest ${index+1}`",
  "||`Step ${i+1}`",
  "selected=HOUSES[hash(`${id}-${Date.now()"
])assert(!js.includes(forbidden),`Guild Quest runtime must not contain dummy data generator: ${forbidden}`);

assert(!js.includes('function isCerbanimo()'),'Guild Quest tracker must not remain owned by Cerbanimo.');

for(const token of [
  '--cil-civweave:var(--mint,#8af5d2)',
  '--cil-living:var(--living,#aeea57)',
  '--cil-cerbanimo:var(--cerb,#e85dff)',
  '--cil-fellowfare:var(--fare,#efb452)',
  '.cil-level-indicator',
  '.cil-carousel',
  'perspective:1050px',
  'transform-style:preserve-3d',
  '.cil-screen-3 .cil-guild-level',
  '.cil-map-grid',
  '.cil-lane',
  '.cil-task.is-complete',
  '.cil-vote',
  '@media(max-width:720px)'
])assert(css.includes(token),`Guild Quest styling missing ${token}`);

for(const token of [
  'It belongs to Civweave, not Cerbanimo.',
  'Guilds → Quests (shared intentions) → Quest Maps',
  'canonical `#aeea57`',
  'canonical `#e85dff`',
  'canonical `#efb452`',
  '/api/hub-map-nodes',
  'must not inject a synthetic "Your Civweave Guild" record',
  'Rendering the tracker must not randomly assign a House',
  '/app/civweave-guild-quest-v1.html',
  'Cerbanimo\'s default realm-console surface no longer loads or owns the Guild Quest Tracker',
  'No dynamic script injection'
])assert(contract.includes(token),`Guild Quest contract missing ${token}`);

assert(civweaveHtml.includes('data-civweave-system="civweave"'),'Civweave Guild Quest page must declare Civweave ownership.');
assert(civweaveHtml.includes('/app/system-routes-v227.js'),'Civweave Guild Quest page must establish route identity before the install boundary.');
assert(civweaveHtml.includes('/app/cerbanimo-intention-landscape-v1.css'),'Civweave Guild Quest page must load Guild Quest CSS.');
assert(civweaveHtml.includes('/app/cerbanimo-intention-landscape-v1.js'),'Civweave Guild Quest page must load Guild Quest runtime.');
assert(!cerbanimoHtml.includes('/app/cerbanimo-intention-landscape-v1.css'),'Cerbanimo must not load Guild Quest CSS.');
assert(!cerbanimoHtml.includes('/app/cerbanimo-intention-landscape-v1.js'),'Cerbanimo must not load Guild Quest runtime.');
assert(topbar.includes("const GUILD_QUEST_ROUTE='/app/civweave-guild-quest-v1.html'"),'Civweave topbar must point to the Guild Quest surface.');
assert(topbar.includes("<span>Guilds</span>"),'Civweave topbar must expose the Guilds control.');
assert(routes.includes("PATH_TO_ID.set('/app/civweave-guild-quest-v1.html','civweave')"),'Route contract must recognize the Guild Quest page as Civweave.');
assert(!js.includes('document.createElement(\'script\')'),'Guild Quest tracker must not dynamically inject scripts.');
assert(!js.includes('new Function'),'Guild Quest tracker must not use runtime code generation.');
assert(!js.includes('eval('),'Guild Quest tracker must not use eval.');

console.log(JSON.stringify({ok:true,feature:'guild-quest-tracker-v1-civweave-owner',owner:'civweave',entry:'/app/civweave-guild-quest-v1.html',hierarchy:['guilds','quests','quest-maps'],screens:3,houses:5,pathways:3,canonicalRealmColors:true,proofAwareProgress:true,governanceVoteBadges:true,liveGuildDirectory:true,noSyntheticGuildFallback:true,cerbanimoDetached:true},null,2));

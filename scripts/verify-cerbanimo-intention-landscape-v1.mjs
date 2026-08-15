import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [js,css,html,contract]=await Promise.all([
  read('public/app/cerbanimo-intention-landscape-v1.js'),
  read('public/app/cerbanimo-intention-landscape-v1.css'),
  read('public/app/realm-console-v140.html'),
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
  'function discoveredGuilds()',
  'function questsFor(guild)',
  'function carousel(items,selected,kind)',
  'function mapPanel(quest)',
  'function voteBadges(task)',
  'Choose a Guild',
  'Choose a Quest',
  'Quest Map',
  'Guilds → Quests → Quest Maps',
  "globalThis.CivweaveGuildQuestTrackerV1=api",
  "const MESH_KEY='federation-finder.mesh-nodes.v1'",
  "const INTENTIONS_KEY='civweave.intentions.v127'"
])assert(js.includes(token),`Guild Quest runtime missing ${token}`);

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
  'Guild = Node.',
  'Quest = Shared intention.',
  'Quest Map = Intention plan.',
  'Guilds (Nodes) → Quests (shared intentions) → Quest Maps',
  'canonical `#aeea57`',
  'canonical `#e85dff`',
  'canonical `#efb452`',
  'No dynamic script injection'
])assert(contract.includes(token),`Guild Quest contract missing ${token}`);

assert(html.includes('/app/cerbanimo-intention-landscape-v1.css'),'Realm console must load Guild Quest CSS.');
assert(html.includes('/app/cerbanimo-intention-landscape-v1.js'),'Realm console must load Guild Quest runtime.');
assert(!js.includes('document.createElement(\'script\')'),'Guild Quest tracker must not dynamically inject scripts.');
assert(!js.includes('new Function'),'Guild Quest tracker must not use runtime code generation.');
assert(!js.includes('eval('),'Guild Quest tracker must not use eval.');

console.log(JSON.stringify({ok:true,feature:'guild-quest-tracker-v1',hierarchy:['guilds','quests','quest-maps'],screens:3,houses:5,pathways:3,canonicalRealmColors:true,proofAwareProgress:true,governanceVoteBadges:true},null,2));

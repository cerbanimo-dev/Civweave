import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [js,css,html]=await Promise.all([
  read('public/app/cerbanimo-intention-landscape-v1.js'),
  read('public/app/cerbanimo-intention-landscape-v1.css'),
  read('public/app/realm-console-v140.html')
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
  "const HOUSE_VOTE_KEY='civweave.anarchadia.pending-proposals.v1'",
  "schema:'civweave.house-change-proposal.v1'",
  "dispatchEvent(new CustomEvent('civweave:anarchadia-proposal-requested'",
  "const GOVERNANCE_DB='civweave-anarchadia-governance-v145'",
  'function carousel(items,selected,kind)',
  'function mapPanel(intention)',
  'function voteBadges(task)',
  'One vote keeps the same color across every related task.',
  "const MESH_KEY='federation-finder.mesh-nodes.v1'",
  "const INTENTIONS_KEY='civweave.intentions.v127'"
])assert(js.includes(token),`Landscape runtime missing ${token}`);

for(const token of [
  '.cil-carousel',
  'perspective:1050px',
  'transform-style:preserve-3d',
  '.cil-screen-3 .cil-hub-level',
  '.cil-map-grid',
  '.cil-lane[data-lane="living-school"]',
  '.cil-lane[data-lane="cerbanimo"]',
  '.cil-lane[data-lane="fellowfare"]',
  '.cil-vote'
])assert(css.includes(token),`Landscape styling missing ${token}`);

assert(html.includes('/app/cerbanimo-intention-landscape-v1.css'),'Realm console must load landscape CSS.');
assert(html.includes('/app/cerbanimo-intention-landscape-v1.js'),'Realm console must load landscape runtime.');

console.log(JSON.stringify({ok:true,feature:'cerbanimo-intention-landscape-v1',screens:3,houses:5,pathways:3,governanceVoteBadges:true},null,2));

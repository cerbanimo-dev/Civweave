import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function patch(rel,replacements){const file=path.join(ROOT,rel);let text=await fs.readFile(file,'utf8');for(const [needle,replacement] of replacements){if(text.includes(replacement))continue;if(!text.includes(needle))throw new Error(`${rel}: patch anchor missing: ${needle.slice(0,90)}`);text=text.replace(needle,replacement)}await fs.writeFile(file,text,'utf8');console.log(`patched ${rel}`)}
await patch('public/app/install-boundary-v146.js',[
  ["const RADIO_TRACK_SUGGESTIONS='/app/radio-track-suggestions-v240.js';", "const RADIO_TRACK_SUGGESTIONS='/app/radio-track-suggestions-v240.js';\nconst CANONICAL_PLAYLISTS='/app/canonical-playlists-v1.js';\nconst RADIO_PLAYLIST_GOVERNANCE='/app/radio-playlist-governance-v1.js';"],
  ["  RADIO_TRACK_SUGGESTIONS,\n  SYSTEMS_MESH_RUNTIME,", "  RADIO_TRACK_SUGGESTIONS,\n  CANONICAL_PLAYLISTS,\n  RADIO_PLAYLIST_GOVERNANCE,\n  SYSTEMS_MESH_RUNTIME,"]
]);
await patch('public/service-worker-radio-core-v305.js',[
  ["  '/app/radio-track-suggestions-v240.js',\n  '/app/radio-track-map-v241.json',", "  '/app/radio-track-suggestions-v240.js',\n  '/app/canonical-playlists-v1.js',\n  '/app/radio-playlist-governance-v1.js',\n  '/app/radio-track-map-v241.json',"]
]);
await patch('public/app/services/fellowfare/app.js',[
  ["import './fulfillment-economy-v2.js';", "import './fulfillment-economy-v2.js';\nimport './goods-fulfillment-v1.js';"]
]);

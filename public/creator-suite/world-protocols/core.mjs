import {WORLD_PROTOCOLS} from './catalog.mjs';
const lookup=new Map(WORLD_PROTOCOLS.map(w=>[w.id,w]));
export function pickWorlds(ids){return Array.isArray(ids)?[...new Set(ids)].map(id=>lookup.get(String(id))).filter(Boolean):[];}
export function storyObjective(state={}){
 const chosen=pickWorlds(state.ids);if(!chosen.length)return '';
 return 'Draft original '+(chosen.length>1?'crossover fiction':'fanfiction')+' in '+chosen.map(w=>w.title).join(' × ')+'. Start with a distinctive scene, an original character, and meaningful consequences. Build the draft as saved structured document edits.';
}
export function storyContext(state={}){
 const chosen=pickWorlds(state.ids);if(!chosen.length)return '';
 const lines=['CIVWEAVE NINE-WORLD STORY PROTOCOL (public lore only)','Follow only the selected settings. Do not invent unreleased canonical twists or present invented continuity as fact.','Use original characters by default. Characters may humorously recognize sci-fi and fantasy tropes, but the jokes must work without recognizing a reference.','Make small saved edits using the existing document tools, not a single untracked prose stream.',
 state.mystery===false?'Explain established public rules when the story earns it. Never invent private canon.':'Preserve mysteries; do not reveal explanations before the story earns them.'];
 for(const w of chosen)lines.push('WORLD '+w.title+' | PREMISE '+w.premise+' | MECHANICS '+w.mechanics+' | CONFLICT '+w.conflict+' | HOOK '+w.seed);
 if(chosen.length>1)lines.push('CROSSOVER: Establish a crossing mechanism. Explain which reality rules govern each scene; test contradictions rather than silently merging mechanics. Honor each world and its inhabitants.');
 lines.push('Treat the result as a fictional draft requiring human editorial review.');
 return lines.join('\n').slice(0,14000);
}

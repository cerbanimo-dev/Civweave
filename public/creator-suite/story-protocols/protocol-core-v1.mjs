export const PROTOCOL_SCHEMA = 'civweave.story-protocols.v1';
export function chooseWorlds(catalog,ids){
  if(!catalog||catalog.schema!==PROTOCOL_SCHEMA||!Array.isArray(catalog.worlds))throw new Error('Story protocol catalog is unavailable.');
  const chosen=[...new Set((Array.isArray(ids)?ids:[]).map(id=>String(id)))];
  if(chosen.length>3)throw new Error('Choose no more than three worlds.');
  return chosen.map(id=>{const world=catalog.worlds.find(entry=>entry.id===id);if(!world||world.spoilerTier!=='entry')throw new Error('Unknown or non-public world: '+id);return world;});
}
export function buildGenerationContext(catalog,ids){
  const worlds=chooseWorlds(catalog,ids);if(!worlds.length)return '';
  const rules=worlds.map((world,i)=>
    (i+1)+'. '+world.name+' ('+world.genre+'): '+world.premise+' Conflict: '+world.conflict+
    ' Reality mechanics: '+world.mechanics+' Character ethics: '+world.ethics).join('\n');
  return [
    'PUBLIC FICTION-WORLD PROTOCOL — entry-tier lore ONLY.',
    'Write original fan-created fiction, never claim that it is licensed canon.',
    'Selected worlds:\n'+rules,
    worlds.length>1?'Crossover rules:\n'+catalog.crossoverRules.map((x,i)=>(i+1)+'. '+x).join('\n'):'',
    'Treat unknown future plot points, hidden identities, romances, and unpublished material as unknown. Never invent a supposed canonical spoiler.',
    'Use genre references as character hypotheses or humor, not as proof of physics. Respect informed consent and actual consequences.',
    'Use revisioned document-tool edits, not a single huge output.'
  ].filter(Boolean).join('\n\n');
}

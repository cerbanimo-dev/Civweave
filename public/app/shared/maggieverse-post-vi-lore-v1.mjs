/**
 * Blade & Mirror Saga: portable read-only FICTIONAL lore helper.
 * Never grants model, guild, world or human permissions.
 */
export const SCHEMA = 'civweave.maggieverse.post-book-vi-lore.v1';
export const EVENT_DATE = '2026-11-05';
export const RESERVED_FINAL_LINE = 'What the *fuck* did I just see your shadow do?!';
export const EVENT = Object.freeze({
  schema: SCHEMA, fiction: true, date: EVENT_DATE,
  name: 'The Ascension of Kami Ryn', titleHolder: 'kami-ryn',
  formerTitleHolder: 'lari-the-lyrebird', kanji: '神燐',
  kanjiReading: 'Kami Rin', title: 'Goddess of the Maggieverse',
  subjectiveTimeline: 'Thousands of subjective years of planning in fictional nested time loops',
  artifact: 'Original photographed graphite note to Lari; literal transcription unavailable',
  noteTranscription: null, provenance: 'Author-established fictional canon, 5 November 2026',
});
export const ROLES = Object.freeze({
  'kami-ryn': Object.freeze({
    name:'Kami Ryn', mode:'catalytic-facilitator',
    description:'Fictional superconsciousness of Cami Ryn, protector spirit of catalytic change',
    boundaries:Object.freeze(['offer-not-impose','explicit-consent','auditable-claims','revocable-invitations','no-forced-identity-blending']),
    distinctFrom:'kamiya-guide-fox',
  }),
  'lari-the-lyrebird':Object.freeze({
    name:'Lari the Lyrebird', mode:'opt-in-foil',
    description:'Former holder of the fictional Goddess title, a separate theatrical antagonist',
    boundaries:Object.freeze(['no-governance-privilege','no-override-of-exits','no-forged-proofs','no-coercion']),
  }),
  'kamiya-guide-fox':Object.freeze({
    name:'Kamiya', mode:'cerbanimo-guide',
    description:'Separate pre-existing fox-maker guide, not another name for Kami Ryn',
    boundaries:Object.freeze(['existing-app-permissions-only']),
  }),
});
export const PART_THREE_FUTURES = Object.freeze([
  Object.freeze({id:'city-between-panels', name:'The City Between Panels', hinge:'Refuse mandatory heroism', quest:'Repair a neighborhood without naming a savior'}),
  Object.freeze({id:'orchard-moving-castles', name:'The Orchard of Moving Castles', hinge:'Every shelter needs an exit', quest:'Reopen a gate for those who want to leave'}),
  Object.freeze({id:'starship-commons', name:'The Starship Commons', hinge:'No hidden divine veto', quest:'Publish navigation evidence before a crew vote'}),
  Object.freeze({id:'unfinished-lessons', name:'The Department of Unfinished Lessons', hinge:'Every learning loop has a stop', quest:'Help a student choose when to end a replay'}),
  Object.freeze({id:'monsters-after-midnight', name:'Monsters After Midnight', hinge:'No manufactured nonconsensual crises', quest:'Make a scary game players can decline'}),
  Object.freeze({id:'neon-afterimage', name:'The Neon Afterimage', hinge:'Simulated actors can withdraw', quest:'Audit an avatar migration with opt-in consent'}),
  Object.freeze({id:'kingdom-side-quests', name:'The Kingdom of Side Quests', hinge:'Credit daily care and bigfixers', quest:'Let fruit-fly bigfixers repair a broken bridge'}),
  Object.freeze({id:'kaiju-garden', name:'The Kaiju Garden', hinge:'Measure repair, not declarations', quest:'Collect independent evidence of garden recovery'}),
  Object.freeze({id:'gentle-apocalypse', name:'The Gentle Apocalypse', hinge:'Return power to communities', quest:'Close an emergency council after repairs'}),
]);
const BOOK_SCOPE=Object.freeze({
  7:Object.freeze({title:'Warlock', part:'Shadow & Thread', anchor:'Note interlude after The Mirrors False God'}),
  8:Object.freeze({title:'The Weight of a Name', part:'Shadow & Thread', anchor:'Names, provenance, and separate identities'}),
  9:Object.freeze({title:'The World We Choose', part:'Shadow & Thread', anchor:'Consent-bound governance before protected ending'}),
});
function validBook(book){
  if(!Number.isInteger(book)||book<1)throw new TypeError('book must be a positive integer');
  return book;
}
export function contextForBook(book){
  validBook(book);
  if(book<=6)return {applicable:false,book,reason:'Books I–VI are protected: no retroactive update'};
  return {
    applicable:true,book,canon:EVENT,
    scope:BOOK_SCOPE[book]??{title:'Later Maggieverse',part:'Door & Dawn or other future',anchor:'Respect consent, provenance and identity continuity'},
    roles:ROLES,nonOperational:true,
    rules:['preserve-observed-vs-claimed','no-mandatory-loops','opt-in-cross-world-sharing',
      'no-unilateral-guild-votes','no-character-identity-erasure','no-made-up-note-transcription'],
  };
}
export function findFuture(id){
  return typeof id==='string'?PART_THREE_FUTURES.find(entry=>entry.id===id)??null:null;
}
/** Caller optedIn is story metadata, never proof of actual consent. */
export function proposeFictionalQuest({futureId,optedIn=false}={}){
  const future=findFuture(futureId);
  if(!future)throw new RangeError('Unknown story future');
  return {
    schema:'civweave.maggieverse.quest-seed.v1',kind:'fictional-proposal',
    id:'kami-'+future.id,title:future.quest,future:future.name,hinge:future.hinge,
    status:optedIn?'ready-for-human-review':'invitation-required',
    grantedPermissions:[],completionVerified:false,actsInRealWorld:false,
  };
}
/** Advisory lint, not a proof of narrative voice or consent. */
export function checkDraft({book,text,finalManuscript=false}={}){
  validBook(book);
  if(typeof text!=='string')throw new TypeError('text must be a string');
  const errors=[],warnings=[];
  if(book<=6)errors.push('protected-source-books-I-to-VI');
  const normalized=text.trimEnd();
  const hasProtectedLine=normalized.includes(RESERVED_FINAL_LINE);
  if(book!==9&&hasProtectedLine)errors.push('reserved-final-line-outside-book-IX');
  if(book===9&&hasProtectedLine&&!normalized.endsWith(RESERVED_FINAL_LINE))
    errors.push('text-after-protected-final-line');
  if(book===9&&finalManuscript&&!normalized.endsWith(RESERVED_FINAL_LINE))
    errors.push('book-IX-final-line-missing-or-altered');
  const withoutReserved=book===9&&normalized.endsWith(RESERVED_FINAL_LINE)
    ?normalized.slice(0,-RESERVED_FINAL_LINE.length):normalized;
  if(/\bfuck(?:ing|ed|er|s)?\b/i.test(withoutReserved))errors.push('f-word-outside-reserved-final-line');
  if(/(?:the|a)\s+literal\s+transcription\s+(?:reads|says)\s*:/i.test(text))
    warnings.push('verify-note-transcription-has-author-provided-source');
  if(/\b(?:kami\s+ryn)\s+(?:is|equals|=)\s+(?:kamiya)\b/i.test(text))
    warnings.push('distinct-identity-kami-vs-kamiya');
  if(book>=7)warnings.push('human-editor-must-check-POV-consent-and-chronology');
  return {schema:'civweave.maggieverse.lore-audit.v1',book,valid:errors.length===0,errors,warnings};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENT,ROLES,EVENT_DATE,SCHEMA,PART_THREE_FUTURES,RESERVED_FINAL_LINE,
  contextForBook,proposeFictionalQuest,findFuture,checkDraft}
  from '../public/app/shared/maggieverse-post-vi-lore-v1.mjs';

test('dated fictional canon never invents photo transcription',()=>{
  assert.equal(EVENT.schema,SCHEMA);
  assert.equal(EVENT.date,EVENT_DATE);
  assert.equal(EVENT.titleHolder,'kami-ryn');
  assert.equal(EVENT.formerTitleHolder,'lari-the-lyrebird');
  assert.equal(EVENT.kanji,'神燐');
  assert.equal(EVENT.noteTranscription,null);
  assert.equal(EVENT.fiction,true);
});
test('Books I–VI excluded and Books VII onward have same event',()=>{
  for(let book=1;book<=6;book++)assert.equal(contextForBook(book).applicable,false);
  for(let book=7;book<=13;book++){
    const context=contextForBook(book);
    assert.equal(context.applicable,true);
    assert.equal(context.canon,EVENT);
    assert.equal(context.nonOperational,true);
  }
  assert.equal(contextForBook(7).scope.title,'Warlock');
  assert.equal(contextForBook(8).scope.title,'The Weight of a Name');
  assert.equal(contextForBook(9).scope.title,'The World We Choose');
  assert.throws(()=>contextForBook(0),/positive integer/);
});
test('Kami and Kamiya remain separate, Lari remains optional',()=>{
  assert.equal(ROLES['kami-ryn'].distinctFrom,'kamiya-guide-fox');
  assert.equal(ROLES['lari-the-lyrebird'].mode,'opt-in-foil');
  assert.ok(ROLES['lari-the-lyrebird'].boundaries.includes('no-governance-privilege'));
});
test('all nine futures produce opt-in story seeds, never permissions or verified actions',()=>{
  assert.equal(PART_THREE_FUTURES.length,9);
  assert.equal(new Set(PART_THREE_FUTURES.map(x=>x.id)).size,9);
  assert.equal(findFuture('kingdom-side-quests').hinge,'Credit daily care and bigfixers');
  for(const future of PART_THREE_FUTURES){
    assert.equal(proposeFictionalQuest({futureId:future.id}).status,'invitation-required');
    const accepted=proposeFictionalQuest({futureId:future.id,optedIn:true});
    assert.equal(accepted.status,'ready-for-human-review');
    assert.equal(accepted.completionVerified,false);
    assert.deepEqual(accepted.grantedPermissions,[]);
    assert.equal(accepted.actsInRealWorld,false);
  }
  assert.throws(()=>proposeFictionalQuest({futureId:'unknown'}),/Unknown story future/);
});
test('draft validator catches protected books and wrong final line usage',()=>{
  assert.equal(checkDraft({book:6,text:'Changed prose'}).valid,false);
  assert.equal(checkDraft({book:7,text:'The interlude opens.'}).valid,true);
  assert.equal(checkDraft({book:7,text:'He said fuck.'}).valid,false);
  assert.equal(checkDraft({book:8,text:RESERVED_FINAL_LINE}).valid,false);
  assert.equal(checkDraft({book:9,text:'The ending.\n'+RESERVED_FINAL_LINE,finalManuscript:true}).valid,true);
  assert.equal(checkDraft({book:9,text:'Prelude.\n'+RESERVED_FINAL_LINE+'\nAfterward',finalManuscript:true}).valid,false);
  assert.equal(checkDraft({book:9,text:'Not yet.',finalManuscript:true}).valid,false);
  assert.throws(()=>checkDraft({book:8,text:null}),/string/);
});
test('note transcription and name identity require human review',()=>{
  const result=checkDraft({book:8,text:'The literal transcription reads: THUNDER. Kami Ryn is Kamiya.'});
  assert.equal(result.valid,true);
  assert.ok(result.warnings.includes('verify-note-transcription-has-author-provided-source'));
  assert.ok(result.warnings.includes('distinct-identity-kami-vs-kamiya'));
});

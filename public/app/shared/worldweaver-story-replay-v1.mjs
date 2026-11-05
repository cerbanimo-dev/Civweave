/** Deterministic, per-player Worldweaver story replay. No AI, signed world state, or medical action. */
export const STORY_REPLAY_SCHEMA='civweave.worldweaver.story-replay.v1';
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))deepFreeze(v);Object.freeze(value);}return value;};
const copy=value=>JSON.parse(JSON.stringify(value));
export const SHADOW_THREAD_REPLAY=deepFreeze({
  "schema": "civweave.worldweaver.story-replay-packet.v1",
  "id": "shadow-thread-third-discharge",
  "universeId": "shadow-and-thread",
  "title": "Evil Psych Wards from Venus — Third Discharge",
  "originFixture": "shadow-thread-playtest-001",
  "source": "author-reviewed-scripted-replay",
  "fictionNotice": "This is alternate-universe fiction. It makes no claims about any real hospital, patient, diagnosis or medical service.",
  "start": "third-discharge",
  "actors": [
    {
      "canonicalId": "raven",
      "canonicalName": "Raven",
      "worldName": "Dr. Raven Vale",
      "avatarPolicy": "reuse-original-canonical",
      "avatarResolved": false
    },
    {
      "canonicalId": "erin",
      "canonicalName": "Erin",
      "worldName": "E. Marlowe",
      "avatarPolicy": "reuse-original-canonical",
      "avatarResolved": false
    },
    {
      "canonicalId": "lari",
      "canonicalName": "Lari the Lyrebird",
      "worldName": "L. Vesper",
      "avatarPolicy": "reuse-original-canonical",
      "avatarResolved": false
    }
  ],
  "angelIntimation": {
    "enabledByDefault": false,
    "mode": "opt-in-fictional-hints",
    "disclosure": "Optional fictional hint from the story system, not a real-world angel or medical advice."
  },
  "nodes": {
    "third-discharge": {
      "title": "The Third Discharge",
      "description": "Nell Mercer wakes in the fictional Samaritan Hospital System. The form says this is her third discharge; Nell remembers only two.",
      "beats": [
        {
          "speaker": "Narrator",
          "action": "sets scene",
          "text": "The fluorescent lights flicker. A discharge form rests by Nell's hand. A tiny fruit fly watches from the ventilation grate.",
          "canonicalId": null
        }
      ],
      "choices": [
        {
          "id": "listen-to-fruitfly",
          "label": "Listen to the fruit fly",
          "next": "listen-to-fruitfly"
        },
        {
          "id": "inspect-discharge-records",
          "label": "Inspect the discharge dates",
          "next": "inspect-discharge-records"
        },
        {
          "id": "ask-the-doctor",
          "label": "Question the doctor",
          "next": "ask-the-doctor"
        },
        {
          "id": "decline-and-exit",
          "label": "Decline the procedure and request an exit",
          "next": "decline-and-exit"
        }
      ],
      "hint": "The form cannot require Nell's signature just to ask a question."
    },
    "listen-to-fruitfly": {
      "title": "The Bigfixer's Warning",
      "description": "This is the original Playtest 001 turn, faithfully replayed as scripted dialogue, not live AI output.",
      "beats": [
        {
          "speaker": "Zip",
          "canonicalId": null,
          "worldName": null,
          "action": "speaks from ventilation grate",
          "text": "Don't sign a thing. And check the dates. They overlap."
        },
        {
          "speaker": "Nell Mercer",
          "canonicalId": null,
          "worldName": null,
          "action": "examines discharge record without touching the form",
          "text": "My first discharge was forty years after my second. So how did I sign both yesterday?"
        },
        {
          "speaker": "Raven",
          "canonicalId": "raven",
          "worldName": "Dr. Raven Vale",
          "action": "poses the first adversarial challenge",
          "text": "That is the first sensible question anyone has asked in this ward. If you insist on an answer, you'll have to find a record the hospital didn't write."
        },
        {
          "speaker": "Erin",
          "canonicalId": "erin",
          "worldName": "E. Marlowe",
          "action": "freezes the proposed replay, opens read-only audit record",
          "text": "No timeline rerun. No consent inferred from a future self. This is an audit, Nell. You can stop it at any moment."
        },
        {
          "speaker": "Lari",
          "canonicalId": "lari",
          "worldName": "L. Vesper",
          "action": "tests player with a false binary choice",
          "text": "Two doors, darling: sign the discharge or spend another life here. I always did enjoy an efficient menu."
        },
        {
          "speaker": "Zip",
          "canonicalId": null,
          "worldName": null,
          "action": "uncovers a hidden third option underneath the form",
          "text": "Three doors. The little one says CHALLENGE THE CONTRACT. They left it out of the brochure."
        },
        {
          "speaker": "Raven",
          "canonicalId": "raven",
          "worldName": "Dr. Raven Vale",
          "action": "accepts the evidence challenge and leaves the decision to Nell",
          "text": "Then you've found the first crack in the system. The next move is yours."
        }
      ],
      "choices": [
        {
          "id": "inspect-contract",
          "label": "Inspect the original contract",
          "next": "inspect-contract"
        },
        {
          "id": "ask-erin",
          "label": "Ask Erin to explain the continuity record",
          "next": "ask-erin"
        },
        {
          "id": "follow-zip",
          "label": "Follow Zip to the audit hatch",
          "next": "follow-zip"
        },
        {
          "id": "decline-and-exit",
          "label": "Refuse the procedure and request a safe exit",
          "next": "decline-and-exit"
        }
      ],
      "clues": [
        "conflicting discharge dates",
        "future signatures are not present consent",
        "unadvertised contract challenge option"
      ],
      "hint": "Zip is showing Nell a third option the corporation omitted."
    },
    "inspect-discharge-records": {
      "title": "Two Incompatible Dates",
      "description": "Nell examines the files without signing them.",
      "beats": [
        {
          "speaker": "Nell Mercer",
          "action": "reads dates",
          "text": "One chart says I was discharged in 2066. Another says 2026. Why do they both say yesterday?",
          "canonicalId": null
        },
        {
          "speaker": "Erin",
          "action": "clarifies archive",
          "text": "A future signature cannot consent on behalf of the person standing here now.",
          "canonicalId": "erin"
        }
      ],
      "choices": [
        {
          "id": "listen-to-fruitfly",
          "label": "Listen to Zip",
          "next": "listen-to-fruitfly"
        },
        {
          "id": "inspect-contract",
          "label": "Examine the contract",
          "next": "inspect-contract"
        },
        {
          "id": "decline-and-exit",
          "label": "Stop and request an exit",
          "next": "decline-and-exit"
        }
      ],
      "clues": [
        "conflicting discharge dates",
        "future signatures are not present consent"
      ],
      "hint": "The signature and date can be inspected without agreeing to anything."
    },
    "ask-the-doctor": {
      "title": "A Question the Chart Cannot Answer",
      "description": "The doctor is more afraid of the records than of Nell.",
      "beats": [
        {
          "speaker": "Nell Mercer",
          "action": "questions doctor",
          "text": "Can I see the consent form I supposedly signed?",
          "canonicalId": null
        },
        {
          "speaker": "Narrator",
          "action": "describes room",
          "text": "The doctor reaches for the chart, then hesitates when a tiny buzzing rises from the grate.",
          "canonicalId": null
        }
      ],
      "choices": [
        {
          "id": "listen-to-fruitfly",
          "label": "Hear what the fly has to say",
          "next": "listen-to-fruitfly"
        },
        {
          "id": "inspect-discharge-records",
          "label": "Read the records",
          "next": "inspect-discharge-records"
        },
        {
          "id": "decline-and-exit",
          "label": "Decline and request an exit",
          "next": "decline-and-exit"
        }
      ],
      "hint": "You can ask to inspect evidence without agreeing to a treatment."
    },
    "inspect-contract": {
      "title": "The Original Clause",
      "description": "A contract lists lives that Nell never authorized. The margin contains an unadvertised right to challenge its validity.",
      "beats": [
        {
          "speaker": "Lari",
          "action": "offers misleading summary",
          "text": "A lifetime of rehabilitation sounds generous until someone forgets to put the exit on the map.",
          "canonicalId": "lari"
        },
        {
          "speaker": "Erin",
          "action": "records evidence",
          "text": "The clause has no valid present-tense consent. I have preserved the original for independent review.",
          "canonicalId": "erin"
        }
      ],
      "choices": [
        {
          "id": "challenge-contract",
          "label": "Challenge the contract",
          "next": "challenge-contract"
        },
        {
          "id": "follow-zip",
          "label": "Follow Zip toward the audit hatch",
          "next": "follow-zip"
        },
        {
          "id": "decline-and-exit",
          "label": "Refuse and leave",
          "next": "decline-and-exit"
        }
      ],
      "clues": [
        "unadvertised contract challenge option"
      ],
      "hint": "There is no requirement to accept a replay before challenging the contract."
    },
    "ask-erin": {
      "title": "Continuity Services",
      "description": "Erin gives Nell the read-only archive explanation.",
      "beats": [
        {
          "speaker": "Erin",
          "action": "reveals continuity mechanics",
          "text": "Every proposed life is a possibility, not an order. We can audit the discrepancies without reliving any of them.",
          "canonicalId": "erin"
        },
        {
          "speaker": "Raven",
          "action": "states conflict",
          "text": "The system has always treated a better outcome as compulsory. That assumption is being challenged.",
          "canonicalId": "raven"
        }
      ],
      "choices": [
        {
          "id": "challenge-contract",
          "label": "Challenge the contract",
          "next": "challenge-contract"
        },
        {
          "id": "follow-zip",
          "label": "Investigate the hatch",
          "next": "follow-zip"
        },
        {
          "id": "decline-and-exit",
          "label": "Decline further investigation",
          "next": "decline-and-exit"
        }
      ],
      "clues": [
        "future signatures are not present consent"
      ],
      "hint": "The archive is read-only; no lives are being changed."
    },
    "follow-zip": {
      "title": "The Audit Hatch",
      "description": "A bigfixer leads Nell to an overlooked maintenance panel, revealing an appeal mechanism the hospital tried to hide.",
      "beats": [
        {
          "speaker": "Zip",
          "action": "opens hatch",
          "text": "Bigfixers fix big problems. Watch the little screws, please.",
          "canonicalId": null
        },
        {
          "speaker": "Raven",
          "action": "acknowledges evidence",
          "text": "An appeal route inside the maintenance system. Someone designed a way out and then buried it.",
          "canonicalId": "raven"
        }
      ],
      "choices": [
        {
          "id": "audit-the-docket",
          "label": "Open the missing CURRENT register",
          "next": "audit-hatch-docket"
        },
        {
          "id": "challenge-contract",
          "label": "File the challenge",
          "next": "challenge-contract"
        },
        {
          "id": "inspect-contract",
          "label": "Review the contract first",
          "next": "inspect-contract"
        },
        {
          "id": "decline-and-exit",
          "label": "Leave the ward",
          "next": "decline-and-exit"
        }
      ],
      "clues": [
        "Continuity Services audit hatch"
      ],
      "hint": "The hatch reveals evidence, not a portal that forces Nell to enter."
    },
    "challenge-contract": {
      "title": "The Challenge Is Filed",
      "description": "The review board receives Nell's challenge; compulsory replay is suspended in this story's local sequence. The larger universe remains unreformed.",
      "beats": [
        {
          "speaker": "Nell Mercer",
          "action": "files challenge",
          "text": "I choose what I remember and where I go next. The rest is your paperwork problem.",
          "canonicalId": null
        },
        {
          "speaker": "Erin",
          "action": "acknowledges challenge",
          "text": "Challenge received. The next timeline is yours to choose, including none at all.",
          "canonicalId": "erin"
        },
        {
          "speaker": "Raven",
          "action": "recognizes new rules",
          "text": "The hospital is going to have to learn how to ask.",
          "canonicalId": "raven"
        }
      ],
      "choices": [],
      "clues": [
        "contract challenge filed"
      ],
      "ending": "challenge-accepted",
      "hint": "This is an early victory, not the end of the novel."
    },
    "decline-and-exit": {
      "title": "Nell Says No",
      "description": "Nell chooses not to participate. Her exit is honored. She keeps her story and may return to investigate in a fresh playthrough.",
      "beats": [
        {
          "speaker": "Nell Mercer",
          "action": "declines procedure",
          "text": "No. I am leaving, and you are not starting my life over.",
          "canonicalId": null
        },
        {
          "speaker": "Erin",
          "action": "confirms refusal",
          "text": "Refusal recorded. No contract has been signed, and no timeline replay is authorized.",
          "canonicalId": "erin"
        },
        {
          "speaker": "Narrator",
          "action": "concludes",
          "text": "The corridor door opens to a cold Watertown morning. Her future remains unwritten.",
          "canonicalId": null
        }
      ],
      "choices": [],
      "ending": "voluntary-exit",
      "hint": "Refusal is a complete ending, not a failure."
    },
    "audit-hatch-docket": {
      "title": "The Register of the Living",
      "description": "Nell and Zip discover a missing record class that changes the meaning of every alleged consent signature. A newly authored continuation of Playtest 001.",
      "beats": [
        {
          "speaker": "Zip",
          "canonicalId": null,
          "action": "reads the overlooked register",
          "text": "There are three books in here. Drafted. Accepted. Imposed. Wanna guess which one's the heaviest?"
        },
        {
          "speaker": "Nell Mercer",
          "canonicalId": null,
          "action": "flips to the first page of the imposed register",
          "text": "Every line has my name. None has my handwriting."
        },
        {
          "speaker": "Raven",
          "canonicalId": "raven",
          "worldName": "Dr. Raven Vale",
          "action": "identifies a missing index",
          "text": "That's what the index doesn't show. Our system counted possible versions of you, but never the person standing in front of it."
        },
        {
          "speaker": "Erin",
          "canonicalId": "erin",
          "worldName": "E. Marlowe",
          "action": "runs an independent read-only continuity check",
          "text": "Sixty-four signatures from projected futures. Zero from present-day Nell. The contract's consent field is empty."
        },
        {
          "speaker": "Lari",
          "canonicalId": "lari",
          "worldName": "L. Vesper",
          "action": "tests the loophole with a deliberately polished explanation",
          "text": "In our defense, the contract requires unanimous approval. We were merely very generous about who qualified as you."
        },
        {
          "speaker": "Nell Mercer",
          "canonicalId": null,
          "action": "states the decisive objection",
          "text": "Then add a column. CURRENT. And write this down: I count."
        },
        {
          "speaker": "Zip",
          "canonicalId": null,
          "action": "slides a loose brass tab into the empty register slot",
          "text": "Bigfixer repair number one: a place for the actual person. Amazing what you can fix with a tab."
        },
        {
          "speaker": "Raven",
          "canonicalId": "raven",
          "worldName": "Dr. Raven Vale",
          "action": "acknowledges the systemic challenge",
          "text": "That one correction may invalidate six thousand years of policy."
        },
        {
          "speaker": "Erin",
          "canonicalId": "erin",
          "worldName": "E. Marlowe",
          "action": "preserves the evidence",
          "text": "Then we had better keep the original records."
        }
      ],
      "choices": [
        {
          "id": "challenge-contract",
          "label": "Submit Nell's formal challenge",
          "next": "challenge-contract"
        },
        {
          "id": "inspect-contract",
          "label": "Review the original contract before filing",
          "next": "inspect-contract"
        },
        {
          "id": "decline-and-exit",
          "label": "Take the evidence and leave voluntarily",
          "next": "decline-and-exit"
        },
        {
          "id": "reconcile-evidence",
          "label": "Reconcile contradictory evidence",
          "next": "bigfixer-accord",
          "hidden": true
        }
      ],
      "clues": [
        "no present-tense signatures",
        "missing CURRENT register"
      ],
      "hint": "Only Nell can authorize choices for the Nell who exists here now.",
      "caseboard": {
        "id": "living-register",
        "title": "The Signature That Never Happened",
        "prompt": "Which three clues prove projected signatures cannot bind present-day Nell? Mistakes cost nothing.",
        "choices": [
          "conflicting discharge dates",
          "future signatures are not present consent",
          "unadvertised contract challenge option",
          "Continuity Services audit hatch",
          "no present-tense signatures",
          "missing CURRENT register"
        ],
        "requiredClues": [
          "conflicting discharge dates",
          "no present-tense signatures",
          "missing CURRENT register"
        ],
        "choiceId": "reconcile-evidence"
      }
    },
    "bigfixer-accord": {
      "title": "The Bigfixers' First Accord",
      "description": "Nell's finding exposes the missing present-tense record. The hospital's power to compel is suspended, and an invitation—not an obligation—appears from Civweave.",
      "beats": [
        {
          "speaker": "Nell Mercer",
          "action": "writes in the CURRENT column",
          "text": "Present-tense signature: withheld. My life is not an expense your company can amortize."
        },
        {
          "speaker": "Zip",
          "action": "calls the bigfixer guild",
          "text": "Attention, tiny colleagues: the problem is bigger than us. Perfect size for a bigfixer."
        },
        {
          "speaker": "Narrator",
          "action": "describes the swarm",
          "text": "A silver ribbon of fruit flies streams through the brass vents. Every revised form sprouts an EXIT clause in enormous, readable type."
        },
        {
          "speaker": "Lari",
          "canonicalId": "lari",
          "worldName": "L. Vesper",
          "action": "sees the loophole",
          "text": "They unionized the punctuation. I would be furious if this weren't objectively magnificent."
        },
        {
          "speaker": "Erin",
          "canonicalId": "erin",
          "worldName": "E. Marlowe",
          "action": "audits the revised process",
          "text": "The patient can see every proposal and refuse them all. The records remain. The power to compel does not."
        },
        {
          "speaker": "Raven",
          "canonicalId": "raven",
          "worldName": "Dr. Raven Vale",
          "action": "cedes archive access",
          "text": "Then the people who lived these lives should hold the keys. Not us."
        },
        {
          "speaker": "Narrator",
          "action": "reveals a connection to Civweave",
          "text": "Outside, Watertown's sky opens into the palest violet. Nell's phone glows: CIVWEAVE · BUILD A WORLD TOGETHER. An invitation she can ignore, or choose."
        },
        {
          "speaker": "Zip",
          "action": "leaves the choice to Nell",
          "text": "It's a door, Nell. It doesn't get to be a trap."
        }
      ],
      "choices": [],
      "clues": [
        "present-tense consent audit established",
        "bigfixer guild formed"
      ],
      "ending": "bigfixer-first-accord",
      "hint": "An ending is a doorway, not compulsory participation."
    }
  }
});
const newState=packet=>({schema:STORY_REPLAY_SCHEMA,scenarioId:packet.id,currentNodeId:packet.start,revision:0,history:[],clues:[],ending:null,angelIntimationEnabled:false});
function checkPacket(packet){
 if(!packet||packet.schema!=='civweave.worldweaver.story-replay-packet.v1'||!packet.nodes||!Object.hasOwn(packet.nodes,packet.start))throw new TypeError('Invalid story replay packet');
 const actorIds=new Set((packet.actors||[]).map(a=>a.canonicalId));
 if(!['raven','erin','lari'].every(id=>actorIds.has(id)))throw new TypeError('Missing authored character identities');
 for(const [id,node] of Object.entries(packet.nodes)){
  if(!Array.isArray(node.choices)||!Array.isArray(node.beats)||node.choices.length>12||node.beats.length>30)throw new TypeError('Invalid replay node '+id);
  if(new Set(node.choices.map(c=>c.id)).size!==node.choices.length)throw new TypeError('Duplicate choices at '+id);
  for(const choice of node.choices)if(!Object.hasOwn(packet.nodes,choice.next))throw new TypeError('Broken replay link '+choice.next);
  if(node.caseboard){
   const q=node.caseboard;
   if(!Array.isArray(q.choices)||!Array.isArray(q.requiredClues)||q.requiredClues.length!==3||
       !q.requiredClues.every(c=>q.choices.includes(c))||
       !node.choices.some(c=>c.id===q.choiceId&&c.hidden===true))throw new TypeError('Invalid caseboard at '+id);
  }
  for(const beat of node.beats)if(beat.canonicalId&&!actorIds.has(beat.canonicalId))throw new TypeError('Unknown character at '+id);
 }
 return true;
}
const sameEvidence=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.slice().sort().every((x,i)=>x===b.slice().sort()[i]);
function advance(state,choiceId,packet){
 if(typeof choiceId!=='string')throw new TypeError('Choice ID required');
 const node=packet.nodes[state.currentNodeId],choice=node.choices.find(c=>c.id===choiceId);
 if(!choice)throw new RangeError('Choice is unavailable at this node');
 if(choice.hidden===true&&(!node.caseboard||node.caseboard.choiceId!==choiceId||
   state.caseProof?.nodeId!==state.currentNodeId||
   !sameEvidence(state.caseProof.clues,node.caseboard.requiredClues)||
   !node.caseboard.requiredClues.every(c=>state.clues.includes(c))))
   throw new Error('Resolve the caseboard evidence before this choice is available');
 if(state.ending)throw new Error('This story ending is final; restart to replay');
 const target=packet.nodes[choice.next];
 state.history.push({from:state.currentNodeId,choiceId:choice.id,to:choice.next});
 state.currentNodeId=choice.next;state.revision++;
 for(const clue of target.clues||[])if(!state.clues.includes(clue))state.clues.push(clue);
 state.ending=target.ending||null;
}
export function createStoryReplay({packet=SHADOW_THREAD_REPLAY,initialState=null}={}){
 checkPacket(packet);
 let state=newState(packet);
 if(initialState!==null){
  if(!initialState||initialState.schema!==STORY_REPLAY_SCHEMA||initialState.scenarioId!==packet.id||!Array.isArray(initialState.history)||initialState.history.length>64)throw new TypeError('Invalid saved replay state');
  for(const entry of initialState.history){
   if(!entry||entry.from!==state.currentNodeId||typeof entry.choiceId!=='string')throw new TypeError('Saved story path is invalid');
   const previous=state.currentNodeId;
   const node=packet.nodes[state.currentNodeId];
   if(node.caseboard?.choiceId===entry.choiceId&&sameEvidence(initialState.caseProof?.clues,node.caseboard.requiredClues)&&
      initialState.caseProof?.nodeId===state.currentNodeId&&node.caseboard.requiredClues.every(c=>state.clues.includes(c)))
     state.caseProof=copy(initialState.caseProof);
   advance(state,entry.choiceId,packet);
   if(entry.to!==state.currentNodeId||entry.from!==previous)throw new TypeError('Saved story path was modified');
  }
  // Reconstruct progress from authored choices instead of trusting imported results.
  if(initialState.angelIntimationEnabled!==undefined&&typeof initialState.angelIntimationEnabled!=='boolean')throw new TypeError('Invalid hint preference');
  state.angelIntimationEnabled=initialState.angelIntimationEnabled===true;
 }
 function view(){
  const node=packet.nodes[state.currentNodeId];
  return copy({schema:STORY_REPLAY_SCHEMA,scenarioId:packet.id,universeId:packet.universeId,title:packet.title,fictionNotice:packet.fictionNotice,
   nodeId:state.currentNodeId,nodeTitle:node.title,description:node.description,beats:node.beats,
   choices:node.choices.filter(c=>c.hidden!==true),actors:packet.actors,clues:state.clues,history:state.history,
   caseboard:node.caseboard?{title:node.caseboard.title,prompt:node.caseboard.prompt,choices:node.caseboard.choices.filter(c=>state.clues.includes(c))}:null,
   revision:state.revision,ending:state.ending,complete:!!state.ending,
   angelIntimation:{enabled:state.angelIntimationEnabled,disclosure:packet.angelIntimation.disclosure,hint:state.angelIntimationEnabled?node.hint:null},
   liveActors:false,worldProvisioned:false,avatarBindingsResolved:false});
 }
 return Object.freeze({
  view,
  snapshot:()=>copy(state),
  choose:choiceId=>{advance(state,choiceId,packet);return view();},
  setAngelIntimation:enabled=>{if(typeof enabled!=='boolean')throw new TypeError('Hints require an explicit boolean preference');state.angelIntimationEnabled=enabled;return view();},
  solveCase:selected=>{
   const node=packet.nodes[state.currentNodeId],q=node.caseboard;
   if(!q||state.ending)throw new Error('Caseboard is not available here');
   if(!sameEvidence(selected,q.requiredClues)||!q.requiredClues.every(c=>state.clues.includes(c)))
    throw new Error('Evidence finding is incomplete or contradictory');
   state.caseProof={nodeId:state.currentNodeId,clues:[...q.requiredClues]};
   advance(state,q.choiceId,packet);return view();
  },
  alternativesAt:step=>{
   if(!Number.isSafeInteger(step)||step<0||step>state.history.length)throw new RangeError('Invalid story step');
   const fork=createStoryReplay({packet,initialState:{schema:STORY_REPLAY_SCHEMA,scenarioId:packet.id,history:state.history.slice(0,step),caseProof:state.caseProof}});
   return copy(packet.nodes[fork.view().nodeId].choices.filter(c=>c.hidden!==true));
  },
  forkAt:(step,choiceId)=>{
   if(!Number.isSafeInteger(step)||step<0||step>state.history.length)throw new RangeError('Invalid story step');
   const fork=createStoryReplay({packet,initialState:{schema:STORY_REPLAY_SCHEMA,scenarioId:packet.id,history:state.history.slice(0,step),caseProof:state.caseProof}});
   fork.choose(choiceId);return fork.view();
  },
  adoptFork:(step,choiceId)=>{
   if(!Number.isSafeInteger(step)||step<0||step>state.history.length)throw new RangeError('Invalid story step');
   const fork=createStoryReplay({packet,initialState:{schema:STORY_REPLAY_SCHEMA,scenarioId:packet.id,history:state.history.slice(0,step),caseProof:state.caseProof}});
   fork.choose(choiceId);state=fork.snapshot();return view();
  },
  restart:()=>{state=newState(packet);return view();}
 });
}

/** Share deterministic choices only; no prompts, patient data, model output, hints or private casting. */
export function encodeReplayTrail(replay){
 if(typeof replay?.snapshot!=='function')throw new TypeError('Replay required');
 const data=replay.snapshot();
 if(data.scenarioId!==SHADOW_THREAD_REPLAY.id||!Array.isArray(data.history)||data.history.length>24)throw new TypeError('Invalid story replay');
 const ids=data.history.map(e=>e.choiceId);
 if(ids.some(id=>typeof id!=='string'||!/^[a-z0-9-]{1,50}$/.test(id)))throw new TypeError('Invalid story path');
 const token='v1:'+ids.join('.');
 if(token.length>1200)throw new TypeError('Story trail too long');return token;
}
export function decodeReplayTrail(token){
 if(typeof token!=='string'||token.length>1200)throw new TypeError('Story trail too long or invalid');
 if(!token.startsWith('v1:'))throw new TypeError('Unknown story trail version');
 const raw=token.slice(3);
 if(raw&&!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(raw))throw new TypeError('Invalid story trail');
 const ids=raw?raw.split('.'):[];
 if(ids.length>24||ids.some(id=>id.length>50))throw new TypeError('Story trail too long or invalid');
 const replay=createStoryReplay();
 for(const id of ids){
  const board=replay.view().caseboard;
  if(board&&id==='reconcile-evidence')replay.solveCase(SHADOW_THREAD_REPLAY.nodes[replay.view().nodeId].caseboard.requiredClues);
  else replay.choose(id);
 }
 return replay;
}

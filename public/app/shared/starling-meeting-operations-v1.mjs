/**
 * Starling Collective meeting record core.
 * Offline-first, deterministic and side-effect-free: no model calls, no speech
 * capture, no votes cast on behalf of humans, no Quest mutations.
 */
const TYPES = new Set(['listening','speech.committed','agenda.updated','decision.proposed','decision.approved','decision.rejected','quest.handoff']);
const NONRECORD_TYPES = new Set(['listening']);
const TEXT_LIMIT = 12000;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj,key);
const requireText = (value, name, max=TEXT_LIMIT) => {
  if (typeof value!=='string' || !value.trim() || value.length>max) throw new TypeError(name+' must be nonempty text within '+max+' characters');
  return value.trim();
};
const participantsById = meeting => new Map(meeting.participants.map(p=>[p.id,p]));
const isKeeper = p => p.kind==='human' && p.role==='guildkeeper';
const cloned = x => JSON.parse(JSON.stringify(x));
const ensureTimestamp = value => {
  if (typeof value!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new TypeError('invalid timestamp');
};
export function createMeeting({meetingId,guildId,createdBy,participants}) {
  requireText(meetingId,'meetingId',120);
  requireText(guildId,'guildId',120);
  requireText(createdBy,'createdBy',120);
  if (!Array.isArray(participants) || !participants.length) throw new TypeError('participants required');
  const ids=new Set();
  const safe=participants.map(p=>{
    if (!p || !['human','agent'].includes(p.kind) || !['guildkeeper','member','agent','observer'].includes(p.role)) throw new TypeError('invalid participant');
    requireText(p.id,'participant id',120);
    if (ids.has(p.id) || (p.kind==='agent' && p.role!=='agent')) throw new TypeError('invalid duplicate or agent role');
    ids.add(p.id);
    return {id:p.id,kind:p.kind,role:p.role};
  });
  if (!ids.has(createdBy) || !isKeeper(safe.find(p=>p.id===createdBy))) throw new Error('guildkeeper must create meeting');
  return {schema:'civweave.starling.meeting.v1',meetingId,guildId,createdBy,participants:safe,events:[]};
}
function derived(meeting) {
  const agenda=[],transcript=[],decisions=[],questHandoffs=[];
  const turnIds=new Set();
  for(const e of meeting.events) {
    const p=e.payload;
    if(e.type==='agenda.updated') agenda.splice(0,agenda.length,...p.items);
    if(e.type==='speech.committed' && !turnIds.has(p.turnId)) {
      turnIds.add(p.turnId);
      transcript.push({turnId:p.turnId,actorId:e.actorId,at:e.at,text:p.text});
    }
    if(e.type==='decision.proposed') decisions.push({decisionId:p.decisionId,title:p.title,proposedBy:e.actorId,status:'proposed'});
    if(e.type==='decision.approved' || e.type==='decision.rejected') {
      const d=decisions.find(x=>x.decisionId===p.decisionId);
      if(d) {d.status=e.type==='decision.approved'?'approved':'rejected';d.resolvedBy=e.actorId;}
    }
    if(e.type==='quest.handoff') questHandoffs.push({decisionId:p.decisionId,questId:p.questId,ownerId:p.ownerId,status:'handoff-pending',requestedBy:e.actorId});
  }
  return {agenda,transcript,decisions,questHandoffs};
}
export function projectMeeting(meeting) {
  if (meeting?.schema!=='civweave.starling.meeting.v1') throw new TypeError('unknown meeting schema');
  return derived(meeting);
}
export function appendMeetingEvent(meeting,event) {
  projectMeeting(meeting);
  if (!event || !TYPES.has(event.type)) throw new TypeError('unknown meeting event');
  const id=requireText(event.id,'event id',120);
  if (meeting.events.some(e=>e.id===id)) return meeting; // at-least-once delivery
  ensureTimestamp(event.at);
  const actorId=requireText(event.actorId,'actorId',120);
  const actor=participantsById(meeting).get(actorId);
  if (!actor) throw new Error('unknown participant');
  const p=event.payload;
  if (!p || typeof p!=='object' || Array.isArray(p)) throw new TypeError('payload required');
  const state=derived(meeting);
  const decision = () => {
    const decisionId=requireText(p.decisionId,'decisionId',120);
    const d=state.decisions.find(x=>x.decisionId===decisionId);
    if (!d) throw new Error('unknown decision');
    return d;
  };
  if (event.type==='listening') return meeting; // observation never becomes a spoken turn
  if (event.type==='speech.committed') {
    requireText(p.turnId,'turnId',120);requireText(p.text,'speech text');
    if (state.transcript.some(t=>t.turnId===p.turnId)) return meeting;
  }
  if (event.type==='agenda.updated') {
    if (!isKeeper(actor)) throw new Error('permission denied: agenda');
    if (!Array.isArray(p.items) || p.items.length>100) throw new TypeError('invalid agenda');
    p.items.forEach(item=>requireText(item,'agenda item',500));
  }
  if (event.type==='decision.proposed') {
    requireText(p.decisionId,'decisionId',120);requireText(p.title,'decision title',1000);
    if (state.decisions.some(d=>d.decisionId===p.decisionId)) throw new Error('duplicate decision');
  }
  if (event.type==='decision.approved' || event.type==='decision.rejected') {
    if (!isKeeper(actor)) throw new Error('permission denied: approval');
    if (decision().status!=='proposed') throw new Error('decision already resolved');
  }
  if (event.type==='quest.handoff') {
    if (!isKeeper(actor)) throw new Error('permission denied: handoff');
    const d=decision();
    if (d.status!=='approved') throw new Error('decision is not approved');
    requireText(p.questId,'questId',120);requireText(p.ownerId,'ownerId',120);
    if (!participantsById(meeting).has(p.ownerId)) throw new Error('unknown Quest owner');
    if (state.questHandoffs.some(q=>q.questId===p.questId)) throw new Error('duplicate Quest handoff');
  }
  // Store an explicit allowlist to avoid persisting speculative model metadata.
  const fields={
    'speech.committed':['turnId','text'],
    'agenda.updated':['items'],
    'decision.proposed':['decisionId','title'],
    'decision.approved':['decisionId'],
    'decision.rejected':['decisionId'],
    'quest.handoff':['decisionId','questId','ownerId']
  }[event.type];
  const payload=Object.fromEntries(fields.filter(key=>own(p,key)).map(key=>[key,cloned(p[key])]));
  return {...meeting,events:[...meeting.events,{id,type:event.type,actorId,at:event.at,payload}]};
}
export function exportMeetingMarkdown(meeting) {
  const s=projectMeeting(meeting);
  const lines=['# Meeting '+meeting.meetingId,'','Guild: '+meeting.guildId,'','## Agenda',...s.agenda.map(x=>'- '+x),'','## Transcript',...s.transcript.map(x=>'- '+x.at+' | '+x.actorId+': '+x.text),'','## Decisions',...s.decisions.map(x=>'- '+x.decisionId+' | '+x.status+' | '+x.title),'','## Quest handoffs (pending canonical Quest confirmation)',...s.questHandoffs.map(x=>'- '+x.questId+' | '+x.ownerId+' | '+x.status),''];
  return lines.join('\n');
}

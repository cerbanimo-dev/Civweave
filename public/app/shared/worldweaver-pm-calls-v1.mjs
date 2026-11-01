/**
 * Encrypted human calls over Civweave's EXISTING PM transport. No unverified
 * global user directory, relay impersonation, or pretend OpenSim sessions.
 * Only explicit contacts can ring the recipient's device.
 */
export const WORLD_CALL_SCHEMA='civweave.world-call.v1';
const PREFIX='cw-world-call1:';
const ref=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/;
const username=/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;
const compact=(value,max=240)=>typeof value==='string'?value.trim().slice(0,max):'';
const identity=x=>typeof x==='string'&&username.test(x);
function encode(packet){return PREFIX+JSON.stringify({schema:WORLD_CALL_SCHEMA,...packet})}
export function decodeWorldCall(body){
 if(typeof body!=='string'||!body.startsWith(PREFIX)||body.length>3500)return null;
 try{
  const p=JSON.parse(body.slice(PREFIX.length));
  if(p.schema!==WORLD_CALL_SCHEMA||!ref.test(p.invitationId||'')||
    !['invite','response'].includes(p.kind)||!identity(p.from)||!identity(p.to))return null;
  if(p.kind==='invite'){
   if(!ref.test(p.worldRef||'')||!Number.isFinite(p.position?.u)||!Number.isFinite(p.position?.v)||
    p.position.u<0||p.position.u>1||p.position.v<0||p.position.v>1||
    !Number.isFinite(Date.parse(p.expiresAt)))return null;
  }else if(!['ringing','accepted','declined','unavailable'].includes(p.status))return null;
  return p;
 }catch{return null}
}
function getPM(){const pm=globalThis.CivweavePrivateMessagingV1;if(!pm?.send||!pm?.conversations||!pm?.identity)throw new Error('Civweave encrypted private messaging is not ready.');return pm}
function verifiedContacts(){const api=globalThis.CivweaveHumanChatNetworkV1;return typeof api?.contacts==='function'?api.contacts().filter(row=>identity(row.username)):[]}
/** Local device sender. PM send may queue offline; "requested" is not a ring receipt. */
export function createPrivateWorldCallTransport(){
 const expected=new Map(),seen=new Set(),subs=new Set();
 let scanning=false,closed=false;
 const pm=()=>getPM();
 async function scan(){
  if(scanning||closed||!expected.size)return;
  scanning=true;
  try{
   for(const row of await pm().conversations()){
    if(row.direction!=='in'||seen.has(row.id))continue;
    const p=decodeWorldCall(row.body);
    if(!p||p.kind!=='response')continue;
    const expectedUser=expected.get(p.invitationId);
    if(!expectedUser||row.from!==expectedUser||p.from!==expectedUser)continue;
    const self=await pm().identity();
    if(p.to!==self?.username)continue;
    seen.add(row.id);
    const status=p.status;
    const event={invitationId:p.invitationId,status,recipientConfiguredResponse:status==='declined'?compact(p.response,240):undefined};
    for(const fn of [...subs])try{fn(event)}catch{}
   }
  }finally{scanning=false}
 }
 const onMessage=()=>{void scan().catch(()=>{})};
 addEventListener('civweave:private-message',onMessage);
 return Object.freeze({
  async listPeople(){return verifiedContacts().map(c=>({id:'pm:'+c.username,title:c.alias||'@'+c.username,description:'Verified Civweave contact · encrypted call'}))},
  async listWorldItems(){return[]},
  async invite(command){
   const to=command.entityRef.startsWith('pm:')?command.entityRef.slice(3):'';
   if(!identity(to)||!verifiedContacts().some(c=>c.username===to))throw new Error('Call recipient must be an existing Civweave contact.');
   if(!ref.test(command.worldRef||''))throw new TypeError('A signed world reference is required.');
   const self=await pm().identity();
   if(!identity(self?.username)||to===self.username)throw new Error('Set up your private messaging identity before calling another user.');
   const invitationId='call:'+crypto.randomUUID(),expiresAt=new Date(Date.now()+10*60*1000).toISOString();
   const packet={kind:'invite',invitationId,from:self.username,to,worldRef:command.worldRef,
    position:command.position,expiresAt};
   const delivered=await pm().send(to,encode(packet));
   if(!delivered?.id)throw new Error('Encrypted call request could not be queued.');
   expected.set(invitationId,to);return {invitationId,status:'requested'};
  },
  async place(){throw new Error('No authorized world placement adapter connected. No entity was spawned.')},
  subscribeInvitations(fn){if(typeof fn!=='function')throw new TypeError('Event listener required');subs.add(fn);void scan().catch(()=>{});return()=>subs.delete(fn)},
  close(){closed=true;removeEventListener('civweave:private-message',onMessage);subs.clear();expected.clear()}
 });
}
/**
 * Always-on while the human chat surface is loaded. Incoming calls are limited
 * to saved contacts and appear as an actionable, nonmodal invitation. Joining
 * still needs an authenticated viewer/world session after pickup.
 */
export function installWorldCallReceiver(){
 const pm=getPM(),seen=new Set();
 let busy=false,closed=false,pending=null,root=null;
 const allowed=name=>verifiedContacts().some(c=>c.username===name);
 function createUI(){
  if(root)return root;
  root=document.createElement('section');root.className='cw-world-incoming-call';
  root.setAttribute('role','region');root.setAttribute('aria-label','Incoming Worldweaver call');
  root.hidden=true;
  const heading=document.createElement('h2'),description=document.createElement('p'),label=document.createElement('label'),
    response=document.createElement('input'),buttons=document.createElement('div'),accept=document.createElement('button'),
    decline=document.createElement('button'),notice=document.createElement('p');
  heading.textContent='Incoming Worldweaver call';
  description.className='cw-world-incoming-description';
  label.textContent='Your decline response';response.type='text';response.maxLength=240;
  response.value=localStorage.getItem('civweave.world-call.decline.v1')||'Sorry, I cannot join right now.';
  label.append(response);buttons.className='cw-world-incoming-buttons';accept.type='button';accept.textContent='Pick up';
  decline.type='button';decline.textContent='Hang up';
  buttons.append(accept,decline);notice.className='cw-world-incoming-notice';
  notice.setAttribute('role','status');root.append(heading,description,label,buttons,notice);document.body.append(root);
  accept.addEventListener('click',()=>void respond('accepted'));
  decline.addEventListener('click',()=>void respond('declined'));
  root._parts={description,response,accept,decline,notice};return root;
 }
 async function respond(status){
  if(!pending)return;
  const call=pending,ui=createUI()._parts;
  ui.accept.disabled=true;ui.decline.disabled=true;ui.notice.textContent='Sending encrypted response…';
  try{
   const self=await pm.identity();
   if(!self?.username)throw new Error('Private messaging identity unavailable.');
   const response=status==='declined'?compact(ui.response.value,240)||'Sorry, I cannot join right now.':'';
   if(status==='declined')localStorage.setItem('civweave.world-call.decline.v1',response);
   const receipt=await pm.send(call.from,encode({kind:'response',invitationId:call.invitationId,from:self.username,
    to:call.from,status,response}));
   if(!receipt?.id)throw new Error('Could not queue reply.');
   pending=null;root.hidden=true;
   if(status==='accepted'){
    // Acceptance is NOT a live simulator session. Let the user enter it.
    dispatchEvent(new CustomEvent('civweave:world-call-accepted',{detail:{worldRef:call.worldRef,
      invitationId:call.invitationId,position:call.position}}));
   }
  }catch(error){ui.notice.textContent=compact(String(error.message||error),180);ui.accept.disabled=false;ui.decline.disabled=false}
 }
 async function scan(){
  if(closed||busy)return;busy=true;
  try{
   const self=await pm.identity();if(!self?.username)return;
   for(const row of (await pm.conversations()).slice().reverse()){
    if(closed||pending)return;
    if(row.direction!=='in'||seen.has(row.id))continue;
    const p=decodeWorldCall(row.body);
    if(!p||p.kind!=='invite'||row.from!==p.from||p.to!==self.username||!allowed(p.from))continue;
    seen.add(row.id);
    if(Date.parse(p.expiresAt)<=Date.now()||Date.parse(p.expiresAt)>Date.now()+11*60*1000)continue;
    pending=p;
    const ui=createUI()._parts;
    ui.description.textContent='@'+p.from+' is calling you to join Worldweaver room '+p.worldRef+'.';
    ui.notice.textContent='Picking up sends a reply; you still choose when to enter the world.';
    ui.accept.disabled=false;ui.decline.disabled=false;root.hidden=false;
    await pm.send(p.from,encode({kind:'response',invitationId:p.invitationId,from:self.username,to:p.from,status:'ringing'})).catch(()=>{});
    break;
   }
  }finally{busy=false}
 }
 const onMessage=()=>{void scan().catch(()=>{})};
 addEventListener('civweave:private-message',onMessage);
 void scan().catch(()=>{});
 return Object.freeze({refresh:scan,close(){closed=true;removeEventListener('civweave:private-message',onMessage);root?.remove();root=null}});
}

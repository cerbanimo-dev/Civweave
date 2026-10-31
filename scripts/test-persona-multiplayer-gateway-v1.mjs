import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonaCampaign} from '../public/app/shared/persona-campaign-v1.mjs';
import {createPersonaMultiplayerGateway} from '../public/app/shared/persona-multiplayer-gateway-v1.mjs';

const pack={schema:'civweave.persona-library.v1',id:'world',version:1,events:[],
 characters:[{id:'jess',name:'Jess',role:'supporting',modelTier:'2b',improvTier:'0.8b',voice:'dry'},
 {id:'magnus',name:'Magnus',role:'protagonist',modelTier:'4b',improvTier:'0.8b',voice:'jokes'}]};
const base=createPersonaCampaign({pack,id:'w:one',ownerId:'member:owner',branchId:'what-if:one',
  scenario:'A moment in the arcade',cast:['jess','magnus']});
const records=new Map([[base.id,base]]);
const authenticated=new Map([['owner',{kind:'human',principalId:'member:owner'}],
 ['bob',{kind:'human',principalId:'member:bob'}],['mallory',{kind:'human',principalId:'member:mallory'}]]);
const loads=async id=>records.get(id);
const writes=async(id,expected,snapshot)=>{
 if(records.get(id)?.revision!==expected)return {ok:false,reason:'conflict'};
 records.set(id,structuredClone(snapshot));return {ok:true,revision:snapshot.revision};
};
const auth=async req=>authenticated.get(req.authToken)||null;
const gateway=()=>createPersonaMultiplayerGateway({authenticate:auth,load:loads,writeIfRevision:writes});
test('unauthenticated users cannot inspect campaign, nor impersonate a principal in an action',async()=>{
 const g=gateway();
 await assert.rejects(()=>g.snapshot({authToken:'unauthorized',campaignId:'w:one'}),/authentication/i);
 await assert.rejects(()=>g.snapshot({authToken:'mallory',campaignId:'w:one'}),/membership|seat|access/i);
 await assert.rejects(()=>g.dispatch({authToken:'bob',campaignId:'w:one',expectedRevision:0,
   command:{type:'assign-player',playerId:'member:bob',roleId:'magnus'}}),/membership|seat|access/i);
});
test('owner grants a seat, player can submit one cue but cannot rewrite cast, owner or canon',async()=>{
 const g=gateway();
 const first=await g.dispatch({authToken:'owner',campaignId:'w:one',expectedRevision:0,
    command:{type:'assign-player',playerId:'member:bob',roleId:'magnus'}});
 assert.equal(first.revision,1);
 const next=await g.dispatch({authToken:'bob',campaignId:'w:one',expectedRevision:1,
   command:{type:'player-cue',text:'I leave the arcade!'}});
 assert.equal(next.turn,1);
 await assert.rejects(()=>g.dispatch({authToken:'bob',campaignId:'w:one',expectedRevision:2,
   command:{type:'stage-set',stage:99}}),/owner|runtime|authorized/i);
 assert.equal((await g.snapshot({authToken:'bob',campaignId:'w:one'})).revision,2);
});
test('two client updates at same revision cannot both commit',async()=>{
 const g=gateway();
 const a=g.dispatch({authToken:'owner',campaignId:'w:one',expectedRevision:2,command:{type:'player-cue',text:'A'}});
 const b=g.dispatch({authToken:'owner',campaignId:'w:one',expectedRevision:2,command:{type:'player-cue',text:'B'}});
 const settled=await Promise.allSettled([a,b]);
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(settled.filter(x=>x.status==='rejected').length,1);
});
test('caller supplied principal, verified bit, or model ID never substitutes for authentication',async()=>{
 const g=gateway();
 await assert.rejects(()=>g.dispatch({authToken:'mallory',campaignId:'w:one',expectedRevision:3,
   actor:{kind:'human',principalId:'member:owner',verified:true},
   command:{type:'stage-set',stage:8}}),/membership|seat|access/i);
});

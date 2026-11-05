import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingSessionGateway} from '../public/app/shared/starling-meeting-session-gateway-v1.mjs';
import {createStarlingMeetingWebSocketTransport} from '../public/app/shared/starling-meeting-websocket-transport-v1.mjs';

const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
class FakeSocket {
  constructor(){this.sent=[];this.listeners=new Map();this.accepted=false;}
  accept(){this.accepted=true;}
  send(value){this.sent.push(JSON.parse(value));}
  close(){this.closed=true;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  fire(name,data){this.listeners.get(name)?.({data});}
  command(action,payload={}){this.fire('message',JSON.stringify({action,payload}));}
}
function fixture(){
  const identities=new Map([
    ['host',{actorId:'host',role:'host',sessionId:'s1',connectionId:'host1'}],
    ['agent',{actorId:'agent',role:'agent',sessionId:'s1',connectionId:'agent1'}],
    ['intruder',{actorId:'intruder',role:'agent',sessionId:'s2',connectionId:'intruder1'}]
  ]);
  const sockets=[];
  const gateway=createMeetingSessionGateway({authenticate:async({token})=>identities.get(token)});
  const transport=createStarlingMeetingWebSocketTransport({
    gateway,
    authorizeUpgrade:async({request,sessionId})=>{
      const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
      const who=identities.get(token);
      if(!who||who.sessionId!==sessionId)throw new Error('unauthorized');
      return {...who,token};
    },
    createPair:()=>{const server=new FakeSocket();sockets.push(server);return [{client:true},server];},
    createUpgradeResponse:({client})=>({status:101,webSocket:client})
  });
  const connect=async token=>transport.attach({sessionId:'s1',request:new Request('https://example.test/meeting',{
    headers:{upgrade:'websocket',authorization:'Bearer '+token}
  })});
  return {identities,sockets,transport,connect};
}
test('unauthorized upgrade is rejected before socket allocation',async()=>{
  const {connect,sockets}=fixture();
  assert.equal((await connect('intruder')).status,401);
  assert.equal((await connect('missing')).status,401);
  assert.equal(sockets.length,0);
});
test('connected agents cannot inject speech and model drafts do not broadcast',async()=>{
  const {connect,sockets}=fixture();
  assert.equal((await connect('host')).status,101);
  assert.equal((await connect('agent')).status,101);
  const [host,agent]=sockets;
  agent.command('speech.chunk',{text:'uninvited'});await flush();
  assert.ok(agent.sent.some(m=>m.type==='meeting.ack'&&m.ok===false));
  assert.equal(host.sent.some(m=>m.type==='speech.chunk'),false);
  agent.command('model.ready',{text:'private model draft'});await flush();
  assert.equal(host.sent.some(m=>JSON.stringify(m).includes('private model draft')),false);
  host.command('host.unmute',{targetId:'agent'});await flush();
  host.command('floor.grant',{targetId:'agent'});await flush();
  agent.command('speech.chunk',{text:'authorized'});await flush();
  assert.ok(host.sent.some(m=>m.type==='speech.chunk'&&m.text==='authorized'));
  host.command('floor.revoke',{});await flush();
  assert.ok(agent.sent.some(m=>m.type==='speech.stop'));
  agent.command('speech.chunk',{text:'after revoke'});await flush();
  assert.equal(host.sent.some(m=>m.type==='speech.chunk'&&m.text==='after revoke'),false);
});
test('duplicate actor connection is refused; leaving revokes speech',async()=>{
  const {connect,sockets}=fixture();
  await connect('host');await connect('agent');
  assert.equal((await connect('agent')).status,409);
  const [host,agent]=sockets;
  host.command('host.unmute',{targetId:'agent'});await flush();
  host.command('floor.grant',{targetId:'agent'});await flush();
  agent.fire('close');await flush();
  assert.equal(sockets[0].sent.some(m=>m.type==='speech.stop'),true);
});

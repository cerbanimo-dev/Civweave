import { GUILD_STARLING_ROUTE, executeGuildStarlingAction } from './guild-starling-collective-v1.mjs';
import { GUILD_QUEST_CORS, guildQuestInternalToken, guildQuestJson, guildQuestError, readGuildQuestInput } from './guild-quest-publications-v1.mjs';

const actions = new Set(['reserve','propose','confirm','abandon','complete','passport','passport-revoke','intention-propose']);
export function guildStarlingAction(request) {
  const tail = new URL(request.url).pathname.slice(GUILD_STARLING_ROUTE.length);
  if (!tail && request.method === 'GET') return 'status';
  if (request.method === 'POST' && actions.has(tail.slice(1)) && tail.startsWith('/')) return tail.slice(1);
  throw Object.assign(new Error('Collective route or method is not supported.'), {status:405});
}
export async function handleGuildStarlingRequest(request, env, authenticate, nodeStub) {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:GUILD_QUEST_CORS});
  try {
    const member=await authenticate(),action=guildStarlingAction(request),input=request.method==='POST'?await readGuildQuestInput(request):{};
    const {stub}=nodeStub(env,member.nodeId),secret=await guildQuestInternalToken(env);
    return await stub.fetch(`https://node.internal/internal/guild-starling?nodeId=${encodeURIComponent(member.nodeId)}`,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':member.nodeId,'x-civweave-internal-starling':secret},body:JSON.stringify({member:{nodeId:member.nodeId,userId:member.userId},action,input})});
  } catch(error) { return guildQuestError(error); }
}
export async function handleGuildStarlingInternal(request,node) {
  try {
    const actual=request.headers.get('x-civweave-internal-starling')||'',expected=await guildQuestInternalToken(node.env);
    const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
    const [a,b]=await Promise.all([hash(actual),hash(expected)]); let difference=0;
    for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
    if(!actual||difference)throw Object.assign(new Error('Guild Collective authorization is required.'),{status:403});
    if(request.method!=='POST')throw Object.assign(new Error('Method not allowed.'),{status:405});
    const body=await readGuildQuestInput(request),nodeId=request.headers.get('x-civweave-node-id');
    if(!nodeId||body.member?.nodeId!==nodeId)throw Object.assign(new Error('Guild Collective scope does not match.'),{status:403});
    // The public payload cannot supply completion proofs, roles, account linkage,
    // member counts or options. Only canonical server owners can attest those.
    const options={};
    if(body.action==='passport'&&typeof node.passportAccountService==='function'){
      const account=await node.passportAccountService().accountForResident(body.member.userId);
      if(account?.passportIds?.includes(body.input?.passportId))options.accountId=account.accountId;
    }
    const result=await executeGuildStarlingAction(node.state.storage,body.member,body.action,body.input,options);
    return guildQuestJson(result,body.action==='reserve'&&!result.idempotent?201:200);
  }catch(error){return guildQuestError(error);}
}

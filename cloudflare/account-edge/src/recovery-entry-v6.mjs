import { EmailMessage } from 'cloudflare:email';
import baseWorker, { CivweaveAccountNode as BaseNode, CivweaveCapacityAccount } from './recovery-entry-v4.mjs';
import { parseInboundProofSubject } from './hub-account-recovery-inbound-v1.mjs';

const PATH='/internal/email-proof';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const email=value=>{const v=clean(value,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw new Error('Recovery mailbox is invalid.');return v};
const nodeId=request=>clean(request.headers.get('x-civweave-node-id')||new URL(request.url).searchParams.get('nodeId'),180).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const mime=(from,to)=>[`From: Civweave Hub <${from}>`,`To: ${to}`,'Subject: Civweave recovery email received','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','','Civweave received your Hub recovery proof. Return to Civweave and paste the one-time code from the message you sent.'].join('\r\n');

export { CivweaveCapacityAccount };
export class CivweaveAccountNode extends BaseNode {
  async fetch(request){
    const path=new URL(request.url).pathname,id=nodeId(request);
    if(request.method==='POST'&&path===PATH){
      if(!id)return json({ok:false,error:'node-id-missing'},400);
      try{return json(await this.approveInboundEmailProof({...await request.json().catch(()=>({})),nodeId:id}))}
      catch(error){return json({ok:false,error:String(error?.message||error)},Number.isSafeInteger(error?.status)?error.status:500)}
    }
    return super.fetch(request);
  }
}

async function receive(message,env){
  const to=email(message.to||''),configured=email(env.HUB_RECOVERY_INBOUND_EMAIL||'');
  if(to!==configured){message.setReject('Unknown Civweave recovery mailbox.');return}
  const proof=parseInboundProofSubject(message.headers.get('subject')||'');
  if(!proof){message.setReject('Invalid Civweave recovery proof subject.');return}
  const from=email(message.from||'');
  await message.reply(new EmailMessage(to,from,mime(to,from)));
  const stub=env.NODES.get(env.NODES.idFromName(proof.nodeId));
  const response=await stub.fetch(`https://recovery.internal${PATH}`,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':proof.nodeId},body:JSON.stringify({...proof,from})});
  if(!response.ok)throw new Error(`Recovery proof approval returned HTTP ${response.status}.`);
}

export default {
  async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path===PATH||/^\/nodes\/[^/]+\/internal\/email-proof$/.test(path))return json({ok:false,error:'not-found'},404);return baseWorker.fetch(request,env,ctx)},
  async email(message,env,ctx){try{await receive(message,env)}catch(error){console.error('Civweave recovery email proof failed',String(error?.message||error));try{message.setReject('Civweave could not validate this recovery proof.')}catch{}}}
};

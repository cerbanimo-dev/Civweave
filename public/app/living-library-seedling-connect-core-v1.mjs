const clean=(v,n=18000)=>String(v??'').trim().slice(0,n);
export function sessionStatus(frame){
  const identity=frame?.CivweaveHubPassportAccountV1?.identity?.()||null;
  const account=frame?.CivweaveHubPassportAccountV1?.current?.()||null;
  const session=Boolean(identity?.userId&&identity?.credential&&account);
  const api=frame?.CivweaveGuideChatSurfaceV350||frame?.CivweavePersistentGuideChatV215;
  const settings=frame?.CivweaveSettingsV320?.readState?.()||{};
  return{session,chatReady:typeof api?.submitText==='function'&&typeof api?.open==='function',
    userId:session?clean(identity.userId,100):'',accountName:session?clean(account.accountName||account.displayName||account.name||'Passport member',100):'',
    provider:clean(settings.provider||settings.route||'Check Civweave settings',80),
    model:clean(settings.model||'',120)};
}
export function getMossThread(frame){
 const api=frame?.CivweaveRealmSessionIntegrityV237;
 let thread=null;try{thread=api?.readThread?.('living-school')||null}catch{}
 return(Array.isArray(thread?.messages)?thread.messages:[]).filter(m=>
   ['user','assistant'].includes(m?.role)&&!m.pending&&clean(m.text||m.content,18000)
 ).slice(-40).map(m=>({id:clean(m.id,120),role:m.role,text:clean(m.text||m.content,18000),
   provider:clean(m.provider,80),error:clean(m.modelError,600),at:clean(m.at,80)}));
}
export async function sendToMoss(frame,prompt){
 const status=sessionStatus(frame);
 if(!status.session)throw Error('Sign in to a Guild with your Passport in the Civweave panel before sending a Moss message.');
 if(!status.chatReady)throw Error('The Civweave chat runtime has not loaded. Open the campus and try again.');
 const message=clean(prompt,6000);
 if(message.length<2)throw Error('Write a message of at least two characters.');
 const api=frame.CivweaveGuideChatSurfaceV350||frame.CivweavePersistentGuideChatV215;
 api.open({guide:'living-school',focus:false});
 const ok=await api.submitText(message,'living-school',{skipAddress:true});
 if(ok!==true)throw Error('Civweave did not acknowledge the Moss message.');
 return{ok:true,thread:getMossThread(frame),submittedAt:new Date().toISOString()};
}
export function transcript(rows){
 return(rows||[]).map(m=>'['+clean(m.at,60)+'] '+(m.role==='assistant'?'Moss':'You')+'\n'+clean(m.text,18000)+'\n').join('\n');
}

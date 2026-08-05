(()=>{
'use strict';

const VERSION='living-school-mutation-guard-v196';
const NativeMutationObserver=globalThis.MutationObserver;
if(!NativeMutationObserver||globalThis.LivingSchoolMutationGuardV196)return;

function isRelayReaderObserver(callback){
  try{
    const source=Function.prototype.toString.call(callback);
    return callback?.name==='queuePatch'&&source.includes('patchReader');
  }catch{return false}
}

function isInsideReader(node){
  if(!node||node.nodeType!==1)return false;
  return Boolean(node.matches?.('[data-two-agent-media],.ls-relay-media')||node.closest?.('[data-two-agent-media],.ls-relay-media,.lsw-reader'));
}

function isRelaySelfMutation(record){
  if(isInsideReader(record?.target))return true;
  const touched=[...(record?.addedNodes||[]),...(record?.removedNodes||[])];
  return touched.length>0&&touched.every(isInsideReader);
}

function GuardedMutationObserver(callback){
  if(!isRelayReaderObserver(callback))return new NativeMutationObserver(callback);
  const wrapped=(records,observer)=>{
    const external=Array.from(records||[]).filter(record=>!isRelaySelfMutation(record));
    if(external.length)callback(external,observer);
  };
  return new NativeMutationObserver(wrapped);
}

GuardedMutationObserver.prototype=NativeMutationObserver.prototype;
Object.setPrototypeOf?.(GuardedMutationObserver,NativeMutationObserver);
globalThis.MutationObserver=GuardedMutationObserver;
globalThis.LivingSchoolMutationGuardV196={version:VERSION,native:NativeMutationObserver};
})();

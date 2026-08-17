(()=>{
'use strict';

const VERSION='1.0.0-quest-language-v1';
if(globalThis.CivweaveQuestLanguageV1?.version===VERSION)return;

const SKIP_SELECTOR='textarea,input,select,option,script,style,.message.user,[data-user-message],[data-role="user"]';
const EXACT=new Map([
  ['WEAVE GENERATED · REVIEW REQUIRED','QUEST GENERATED · REVIEW REQUIRED'],
  ['Review weave','Review Quest'],
  ['Revise wish','Revise Quest'],
  ['Reviewable weave','Reviewable Quest'],
  ['Wish:','Quest goal:'],
  ['What is your wish? Tell me what you want to make true. I will map the learning, skilled work, materials, and agreements it may require.','What Quest do you want to begin? Tell me what you want to make true. I will map the learning, skilled work, materials, and agreements it may require.'],
  ['This is a real saved weave in REVIEW, not a chat-only outline. Nothing has been activated.','This is a real saved Quest in REVIEW, not a chat-only outline. Nothing has been activated.']
]);
const PHRASES=[
  [/\breviewable weave\b/g,'reviewable Quest'],
  [/\bReviewable weave\b/g,'Reviewable Quest'],
  [/\bsaved weave\b/g,'saved Quest'],
  [/\bSaved weave\b/g,'Saved Quest'],
  [/\bthe weave is in REVIEW\b/g,'the Quest is in REVIEW'],
  [/\bThe weave is in REVIEW\b/g,'The Quest is in REVIEW'],
  [/\bstated wish\b/g,'Quest goal'],
  [/\bRevise wish\b/g,'Revise Quest'],
  [/\bReview weave\b/g,'Review Quest'],
  [/\bactivate the weave\b/g,'activate the Quest'],
  [/\bActivate the weave\b/g,'Activate the Quest']
];

function canonicalText(value){
  let text=String(value??'');
  const exact=EXACT.get(text.trim());
  if(exact){
    const leading=text.match(/^\s*/)?.[0]||'';
    const trailing=text.match(/\s*$/)?.[0]||'';
    return `${leading}${exact}${trailing}`;
  }
  for(const [pattern,replacement] of PHRASES)text=text.replace(pattern,replacement);
  return text;
}

function safeTextNode(node){
  const parent=node?.parentElement;
  if(!parent||parent.closest(SKIP_SELECTOR))return false;
  const before=node.nodeValue||'',after=canonicalText(before);
  if(after===before)return false;
  node.nodeValue=after;
  return true;
}

function normalize(root=document.body){
  if(!root)return 0;
  let changed=0;
  if(root.nodeType===Node.TEXT_NODE)return safeTextNode(root)?1:0;
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return 0;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode()))if(safeTextNode(node))changed++;
  return changed;
}

let queued=false;
function queueNormalize(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;normalize(document.body)});
}

function install(){
  normalize(document.body);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData')safeTextNode(record.target);
      for(const node of record.addedNodes||[])normalize(node);
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  addEventListener('civweave:intentions-changed',queueNormalize);
  addEventListener('civweave:working-campus-plan-built',queueNormalize);
  addEventListener('civweave:weave-review-ready',queueNormalize);
  document.documentElement.dataset.civweaveQuestLanguage=VERSION;
  return observer;
}

globalThis.CivweaveQuestLanguageV1=Object.freeze({version:VERSION,canonicalText,normalize,install});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

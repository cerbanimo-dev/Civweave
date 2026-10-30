(()=>{
'use strict';
const SCHEMA='civweave.structured-document.v1';
const TYPES=new Set(['heading','paragraph','bullet','numbered','quote','code','divider','table','caption']);
const STATUSES=new Set(['draft','review','ready']);
const MAX_CHARS=10_000_000;
const clone=value=>structuredClone(value);
const string=value=>String(value??'');
function fresh(sessionId,plain=''){
  if(!sessionId)throw new Error('Document session ID required.');
  const body=string(plain);
  return{schema:SCHEMA,id:'document:'+sessionId,sessionId,revision:0,title:'',goal:'',status:'draft',
    blocks:body?[{id:crypto.randomUUID(),type:'paragraph',text:body}]:[],
    requestIds:[],updatedAt:new Date().toISOString(),lastChange:'Created document'};
}
function check(doc){
  if(doc?.schema!==SCHEMA||!Array.isArray(doc.blocks)||!Number.isInteger(doc.revision)||!doc.sessionId)
    throw new Error('Invalid structured document.');
}
function render(doc){
  check(doc);
  return doc.blocks.map(block=>{
    if(block.type==='divider')return '---';
    if(block.type==='heading')return '#'.repeat(block.level||1)+' '+block.text;
    if(block.type==='bullet')return '- '+block.text;
    if(block.type==='numbered')return '1. '+block.text;
    if(block.type==='quote')return '> '+block.text;
    if(block.type==='code')return '~~~\n'+block.text+'\n~~~';
    return block.text;
  }).join('\n\n');
}
function outline(doc){
  check(doc);
  return doc.blocks.filter(block=>block.type==='heading').map(block=>({id:block.id,level:block.level||1,title:block.text.slice(0,160)}));
}
function status(doc,includeText=false){
  check(doc);
  const body=render(doc);
  const words=body.trim()?body.trim().split(/\s+/u).length:0;
  return{schema:'civweave.document-status.v1',sessionId:doc.sessionId,revision:doc.revision,
    title:doc.title,status:doc.status,goal:doc.goal,outline:outline(doc),
    blockCount:doc.blocks.length,wordCount:words,characterCount:body.length,
    lastChange:doc.lastChange,updatedAt:doc.updatedAt,
    tail:doc.blocks.slice(-4).map(block=>({id:block.id,type:block.type,text:block.text.slice(0,240)})),
    ...(includeText?{text:body}:{} )};
}
function asBlock(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Edit block must be an object.');
  const type=string(input.type||'paragraph').trim().toLowerCase();
  if(!TYPES.has(type))throw new Error('Unsupported document block type: '+type);
  const text=string(input.text);
  if(text.length>200_000)throw new Error('A single block may not exceed 200000 characters.');
  if(!text.trim()&&type!=='divider')throw new Error('Document block text cannot be empty.');
  const level=type==='heading'?Math.max(1,Math.min(6,Math.round(Number(input.level)||1))):undefined;
  return{id:crypto.randomUUID(),type,text,...(level?{level}:{})};
}
function afterIndex(blocks,id){
  if(id===null||id===undefined||id==='')return -1;
  const index=blocks.findIndex(block=>block.id===id);
  if(index===-1)throw new Error('Anchor block not found: '+id);
  return index;
}
function apply(source,edits,{expectedRevision,requestId='',maxEdits=64}={}){
  check(source);
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)
    throw new Error('expectedRevision is required for safe editing.');
  const key=string(requestId).trim().slice(0,180);
  if(key&&source.requestIds?.includes(key))return{document:clone(source),duplicate:true,applied:0};
  if(source.revision!==expectedRevision)
    throw new Error('Revision conflict: document is at '+source.revision+', requested '+expectedRevision+'. Refresh status and retry.');
  if(!Array.isArray(edits)||!edits.length||edits.length>Math.min(64,Math.max(1,maxEdits)))
    throw new Error('Batch must contain 1 to '+Math.min(64,Math.max(1,maxEdits))+' edits.');
  const doc=clone(source);
  for(const edit of edits){
    if(!edit||typeof edit!=='object'||Array.isArray(edit))throw new Error('Invalid edit.');
    const op=string(edit.op).trim();
    if(op==='append'||op==='insertAfter'){
      const block=asBlock(edit.block);
      const index=op==='append'?doc.blocks.length-1:afterIndex(doc.blocks,edit.afterId);
      doc.blocks.splice(index+1,0,block);
    }else if(op==='replaceBlock'){
      const index=afterIndex(doc.blocks,edit.blockId);
      doc.blocks[index]={...asBlock(edit.block),id:doc.blocks[index].id};
    }else if(op==='deleteBlock'){
      const index=afterIndex(doc.blocks,edit.blockId);
      doc.blocks.splice(index,1);
    }else if(op==='moveBlock'){
      const index=afterIndex(doc.blocks,edit.blockId);
      const [block]=doc.blocks.splice(index,1);
      const anchor=afterIndex(doc.blocks,edit.afterId);
      doc.blocks.splice(anchor+1,0,block);
    }else if(op==='setTitle'){
      const title=string(edit.title).trim();
      if(!title||title.length>120)throw new Error('Document title must have 1 to 120 characters.');
      doc.title=title;
    }else if(op==='setGoal'){
      doc.goal=string(edit.goal).trim().slice(0,1200);
    }else if(op==='setStatus'){
      if(!STATUSES.has(edit.status))throw new Error('Document status must be draft, review, or ready.');
      doc.status=edit.status;
    }else if(op==='replaceAll'){
      if(!Array.isArray(edit.blocks)||edit.blocks.length>1000)throw new Error('replaceAll needs at most 1000 blocks.');
      doc.blocks=edit.blocks.map(asBlock);
    }else throw new Error('Unsupported document edit operation: '+op);
  }
  if(render(doc).length>MAX_CHARS)throw new Error('Document exceeds maximum length.');
  doc.revision++;
  doc.updatedAt=new Date().toISOString();
  doc.lastChange=edits.length+' edit'+(edits.length===1?'':'s')+' saved';
  if(key)doc.requestIds=[...(doc.requestIds||[]),key].slice(-128);
  return{document:doc,duplicate:false,applied:edits.length};
}
function fromHuman(source,text){
  check(source);
  const doc=clone(source),content=string(text);
  if(content.length>MAX_CHARS)throw new Error('Document exceeds maximum length.');
  const pieces=content?content.split(/\n\s*\n/u):[];
  doc.blocks=pieces.filter(Boolean).map((piece,index)=>{
    let type='paragraph',value=piece,level;
    const heading=piece.match(/^(#{1,6}) (.+)$/s);
    if(heading){type='heading';level=heading[1].length;value=heading[2];}
    else if(piece==='---'){type='divider';value='';}
    else if(piece.startsWith('- ')){type='bullet';value=piece.slice(2);}
    else if(/^1\. /u.test(piece)){type='numbered';value=piece.slice(3);}
    else if(piece.startsWith('> ')){type='quote';value=piece.slice(2);}
    else if(piece.startsWith('~~~\n')&&piece.endsWith('\n~~~')){type='code';value=piece.slice(4,-4);}
    const block={id:source.blocks[index]?.type===type?source.blocks[index].id:crypto.randomUUID(),type,text:value};
    if(level)block.level=level;
    return block;
  });
  doc.revision++;doc.updatedAt=new Date().toISOString();doc.lastChange='Human text edit saved';
  return doc;
}
globalThis.CivweaveStructuredDocumentV1=Object.freeze({schema:SCHEMA,fresh,check,render,outline,status,apply,fromHuman});
})();
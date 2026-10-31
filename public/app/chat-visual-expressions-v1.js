(()=>{
'use strict';
const VERSION='1.0.0';
if(globalThis.CivweaveChatVisualsV1?.version===VERSION)return;
const ROOT='cw-persistent-guide-chat-v215';
const FENCE=String.fromCharCode(96).repeat(3);
const PATTERN=new RegExp(FENCE+'cw-view\\s*\\r?\\n([\\s\\S]*?)\\r?\\n'+FENCE,'gi');
const TINY=/\b(?:135m|360m|0[.]5b|0[.]6b|0[.]8b|1b)\b/i;
const SMALL=/\b(?:1[.]5b|2b|3b|4b|6b|7b|8b|9b)\b/i;
const TYPES=['card','cards','metric','meter','steps','timeline','choices','quiz','chart','table','diagram','character'];
const FACES=Object.freeze({
  civweave:'/app/assets/ai/chat/weaveling-face-v255.webp',
  weaveling:'/app/assets/ai/chat/weaveling-face-v255.webp',
  moss:'/app/assets/ai/chat/moss-face-v255.webp',
  'living-school':'/app/assets/ai/chat/moss-face-v255.webp',
  kamiya:'/app/assets/ai/chat/kamiya-face-v255.webp',
  cerbanimo:'/app/assets/ai/chat/kamiya-face-v255.webp',
  rook:'/app/assets/ai/chat/rook-face-v255.webp',
  fellowfare:'/app/assets/ai/chat/rook-face-v255.webp',
  merlin:'/app/assets/ai/chat/merlin-face-v255.webp',
  anarchadia:'/app/assets/ai/chat/merlin-face-v255.webp'
});
const s=(value,max=400)=>String(value??'').slice(0,max);
const num=(value,def=0)=>Number.isFinite(Number(value))?Number(value):def;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,num(value)));
const list=(items,limit=12)=>Array.isArray(items)?items.slice(0,limit):[];
const isObj=value=>value&&typeof value==='object'&&!Array.isArray(value);
function valid(value){
  if(!isObj(value)||!TYPES.includes(value.type)||JSON.stringify(value).length>9000)return false;
  if(value.type==='chart'&&(!Array.isArray(value.labels)||!Array.isArray(value.values)))return false;
  if(value.type==='table'&&(!Array.isArray(value.headers)||!Array.isArray(value.rows)))return false;
  if(value.type==='quiz'&&(!Array.isArray(value.options)||value.options.length<2))return false;
  if(['steps','timeline','cards','choices','diagram'].includes(value.type)&&!Array.isArray(value.items||value.nodes))return false;
  return true;
}
function parse(raw){try{const value=JSON.parse(raw);return valid(value)?value:null}catch{return null}}
function extract(raw){
  const source=String(raw||'').slice(0,48000),views=[];
  PATTERN.lastIndex=0;
  const text=source.replace(PATTERN,(matched,payload)=>{
    if(views.length>=3||payload.length>9000)return matched;
    const view=parse(payload.trim());
    if(!view)return matched;
    views.push(view);return '';
  }).replace(/\n{3,}/g,'\n\n').trim();
  // Tiny models can express visuals without producing a nested JSON document.
  const short=/\[\[cw:(meter|character)\|([^\]\r\n]{1,260})\]\]/gi;
  const visible=text.replace(short,(matched,type,parts)=>{
    if(views.length>=3)return matched;
    const cells=parts.split('|').map(x=>x.trim());
    if(type==='meter'&&cells.length>=2){views.push({type:'meter',title:s(cells[0],90),value:num(cells[1]),max:Math.max(1,num(cells[2],100))});return '';}
    if(type==='character'&&cells.length>=2){views.push({type:'character',character:s(cells[0],32),mood:s(cells[1],32),speech:s(cells[2]||'',180)});return '';}
    return matched;
  }).trim();
  return{text:visible,views};
}
function element(tag,cls,content){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(content!==undefined&&content!==null)node.textContent=s(content,1200);
  return node;
}
function addTitle(host,v){
  if(v.title)host.append(element('h4','cwvis-title',s(v.title,130)));
  if(v.description)host.append(element('p','cwvis-description',s(v.description,450)));
}
function installStyle(){
  if(document.getElementById('cw-chat-visuals-v1-style'))return;
  const style=document.createElement('style');style.id='cw-chat-visuals-v1-style';
  style.textContent=[
    '#'+ROOT+' .cw350-visual-rail{display:grid;gap:9px;margin-top:9px;min-width:0;max-width:100%;width:100%;overflow-wrap:anywhere}',
    '#'+ROOT+' .cwvis{min-width:0;max-width:100%;padding:12px;border:1px solid color-mix(in srgb,var(--guide-accent,#8bd9cd) 38%,#8b9bb5);border-radius:14px;background:linear-gradient(155deg,#142234,#0b1525);color:#f3f7fd;overflow:hidden}',
    '#'+ROOT+' .cwvis-title{margin:0 0 8px;font-size:14px;line-height:1.3;letter-spacing:.01em}',
    '#'+ROOT+' .cwvis-description{margin:0 0 8px;color:#c4cfdf;font-size:12px;line-height:1.4}',
    '#'+ROOT+' .cwvis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,132px),1fr));gap:8px}',
    '#'+ROOT+' .cwvis-tile{border:1px solid #ffffff24;border-radius:10px;padding:9px;background:#ffffff0a;min-width:0}',
    '#'+ROOT+' .cwvis-tile strong{display:block;font-size:13px;overflow-wrap:anywhere}',
    '#'+ROOT+' .cwvis-tile p{margin:5px 0 0;font-size:12px;color:#c3cddb;white-space:pre-wrap}',
    '#'+ROOT+' .cwvis-number{display:block;font-size:clamp(22px,6vw,36px);font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums}',
    '#'+ROOT+' .cwvis-track{height:11px;border-radius:999px;background:#ffffff27;overflow:hidden;margin:9px 0 5px}',
    '#'+ROOT+' .cwvis-fill{height:100%;width:0;background:var(--guide-accent,#72d8b4);border-radius:inherit;transition:width .35s ease}',
    '#'+ROOT+' .cwvis-small{color:#c4cfdd;font-size:12px;font-variant-numeric:tabular-nums}',
    '#'+ROOT+' .cwvis-step{display:block;border-left:2px solid var(--guide-accent,#72d8b4);padding:3px 0 8px 12px;margin:3px 0}',
    '#'+ROOT+' .cwvis-step summary{cursor:pointer;font-size:13px;font-weight:700}',
    '#'+ROOT+' .cwvis-step p{margin:5px 0 0;color:#cbd4e0;font-size:12px;white-space:pre-wrap}',
    '#'+ROOT+' .cwvis-actions{display:flex;flex-wrap:wrap;gap:7px}',
    '#'+ROOT+' .cwvis button{min-height:38px;padding:8px 10px;border:1px solid var(--guide-accent,#72d8b4);border-radius:9px;background:#ffffff11;color:#fff;font:650 12px/1.2 system-ui;cursor:pointer;text-align:left}',
    '#'+ROOT+' .cwvis button:focus-visible{outline:3px solid #fff;outline-offset:2px}',
    '#'+ROOT+' .cwvis-chart{display:grid;gap:8px}',
    '#'+ROOT+' .cwvis-bar{display:grid;grid-template-columns:minmax(65px,1fr) 2fr auto;gap:7px;align-items:center;font-size:11px}',
    '#'+ROOT+' .cwvis-bar .cwvis-track{margin:0;height:13px}',
    '#'+ROOT+' .cwvis-scroll{width:100%;overflow-x:auto}',
    '#'+ROOT+' .cwvis table{border-collapse:collapse;width:100%;font-size:12px}',
    '#'+ROOT+' .cwvis th,#'+ROOT+' .cwvis td{padding:7px;text-align:left;border-bottom:1px solid #ffffff22;vertical-align:top}',
    '#'+ROOT+' .cwvis th{color:#b5ebdd;font-weight:750}',
    '#'+ROOT+' .cwvis-figure{display:flex;align-items:center;gap:12px}',
    '#'+ROOT+' .cwvis-face{flex:none;width:78px;height:78px;object-fit:cover;border-radius:18px;border:2px solid var(--guide-accent,#72d8b4);animation:cwvis-bob 3.2s ease-in-out infinite}',
    '#'+ROOT+' .cwvis[data-mood="thinking"] .cwvis-face{animation-duration:1.5s}',
    '#'+ROOT+' .cwvis[data-mood="excited"] .cwvis-face{animation-duration:.75s}',
    '#'+ROOT+' .cwvis-figure strong{display:block;margin-bottom:4px;text-transform:capitalize}',
    '#'+ROOT+' .cwvis-figure p{margin:0;color:#ccd8e5;font-size:12px;white-space:pre-wrap}',
    '#'+ROOT+' .cwvis-feedback{margin-top:9px;font-size:12px;color:#c9f2dc}',
    '@keyframes cwvis-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    '@media(prefers-reduced-motion:reduce){#'+ROOT+' .cwvis-face,#'+ROOT+' .cwvis-fill{animation:none!important;transition:none!important}}',
    '@media(max-width:390px){#'+ROOT+' .cwvis{padding:9px}#'+ROOT+' .cwvis-face{width:58px;height:58px}#'+ROOT+' .cwvis-bar{grid-template-columns:1fr;gap:3px}}'
  ].join('\n');
  document.head.append(style);
}
function metric(host,v){
  const value=element('strong','cwvis-number',s(v.value??0,70));host.append(value);
  if(v.label)host.append(element('span','cwvis-small',s(v.label,160)));
}
function meter(host,v){
  const max=Math.max(1,num(v.max,100)),value=clamp(v.value,0,max),pct=100*value/max;
  const track=element('div','cwvis-track'),fill=element('div','cwvis-fill');
  fill.style.width=pct.toFixed(2)+'%';
  track.setAttribute('role','progressbar');track.setAttribute('aria-label',s(v.label||v.title||'Progress',100));
  track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(max));track.setAttribute('aria-valuenow',String(value));
  track.append(fill);host.append(track,element('span','cwvis-small',s(v.label||'Progress',100)+' · '+value+' / '+max));
}
function cards(host,v){
  const grid=element('div','cwvis-grid');
  for(const item of list(v.items,8)){
    const tile=element('div','cwvis-tile');
    if(typeof item==='string')tile.append(element('strong','',item));
    else{tile.append(element('strong','',s(item?.title||item?.label,150)));if(item?.body||item?.description)tile.append(element('p','',s(item.body||item.description,350)));}
    grid.append(tile);
  }
  host.append(grid);
}
function steps(host,v){
  const wrap=element('div','');
  for(const [index,item] of list(v.items,12).entries()){
    const title=typeof item==='string'?item:item?.title||item?.label;
    const desc=typeof item==='string'?'':item?.body||item?.description;
    const detail=element('details','cwvis-step'),summary=element('summary','',String(index+1)+'. '+s(title,150));
    detail.append(summary);
    if(desc)detail.append(element('p','',s(desc,500)));
    if(!desc)detail.open=true;
    wrap.append(detail);
  }
  host.append(wrap);
}
function choices(host,v,context){
  const wrap=element('div','cwvis-actions');
  for(const option of list(v.options||v.items,8)){
    const label=typeof option==='string'?option:option?.label||option?.title;
    const prompt=typeof option==='string'?option:option?.prompt||option?.question||label;
    const button=element('button','',s(label,120));button.type='button';
    button.addEventListener('click',()=>{
      const api=globalThis.CivweaveGuideChatSurfaceV350;
      api?.open?.({guide:context.system,focus:true,prefill:s(prompt,1600)});
    });
    wrap.append(button);
  }
  host.append(wrap);
  host.append(element('p','cwvis-small','Selecting an option prepares a message. You decide whether to send it.'));
}
function quiz(host,v){
  const question=element('p','cwvis-description',s(v.question||v.title,260));
  host.append(question);
  const wrap=element('div','cwvis-actions'),feedback=element('p','cwvis-feedback');
  feedback.setAttribute('role','status');
  const options=list(v.options,8),answer=Number.isInteger(Number(v.answerIndex))?Number(v.answerIndex):Number(v.answer);
  options.forEach((option,index)=>{
    const label=typeof option==='string'?option:option?.label;
    const button=element('button','',s(label,180));button.type='button';
    button.addEventListener('click',()=>{
      const known=answer>=0&&answer<options.length;
      feedback.textContent=(known?(index===answer?'Correct. ':'Try another answer. '):'Selected: '+s(label,120)+'. ')+s(v.explanation||'',500);
    });
    wrap.append(button);
  });
  host.append(wrap,feedback);
}
function chart(host,v){
  const labels=list(v.labels,12),values=list(v.values,12).map(x=>Math.max(0,num(x)));
  const max=Math.max(1,...values),wrap=element('div','cwvis-chart');
  labels.forEach((label,index)=>{
    const value=values[index]||0,row=element('div','cwvis-bar');
    row.append(element('span','',s(label,65)));
    const track=element('div','cwvis-track'),fill=element('div','cwvis-fill');
    fill.style.width=(value/max*100).toFixed(2)+'%';
    track.append(fill);row.append(track,element('span','',String(value)));wrap.append(row);
  });host.append(wrap);
}
function table(host,v){
  const scroll=element('div','cwvis-scroll'),tab=element('table',''),head=element('thead',''),headrow=element('tr',''),body=element('tbody','');
  const headers=list(v.headers,7);
  for(const label of headers)headrow.append(element('th','',s(label,90)));
  head.append(headrow);tab.append(head);
  for(const values of list(v.rows,16)){
    const tr=element('tr','');
    for(const value of list(Array.isArray(values)?values:[],headers.length))tr.append(element('td','',s(value,180)));
    body.append(tr);
  }
  tab.append(body);scroll.append(tab);host.append(scroll);
}
function diagram(host,v){
  const nodes=list(v.nodes||v.items,12),wrap=element('div','');
  nodes.forEach((n,index)=>{
    const item=element('div','cwvis-step');
    item.append(element('strong','',s(typeof n==='string'?n:n?.label||n?.title,140)));
    if(n?.detail||n?.description)item.append(element('p','',s(n.detail||n.description,350)));
    if(index<nodes.length-1)item.append(element('span','cwvis-small','↓'));
    wrap.append(item);
  });host.append(wrap);
}
function character(host,v,context){
  const key=s(v.character||context.system,40).toLowerCase(),face=FACES[key]||FACES[context.system]||FACES.civweave;
  host.dataset.mood=['idle','thinking','excited','curious','concerned','celebrating'].includes(v.mood)?v.mood:'idle';
  const figure=element('div','cwvis-figure'),img=document.createElement('img'),words=element('div','');
  img.src=face;img.alt=s(v.character||context.system,60);img.className='cwvis-face';img.loading='lazy';
  words.append(element('strong','',s(v.mood||'idle',50)),element('p','',s(v.speech||v.text||'',550)));
  figure.append(img,words);host.append(figure);
}
function render(view,context={}){
  if(!valid(view))return null;
  const host=element('section','cwvis');
  host.dataset.visualType=view.type;
  host.setAttribute('aria-label',s(view.title||view.type+' visual',150));
  addTitle(host,view);
  switch(view.type){
    case 'card':{
      if(view.body)host.append(element('p','cwvis-description',s(view.body,1000)));
      break;
    }
    case 'cards':cards(host,view);break;
    case 'metric':metric(host,view);break;
    case 'meter':meter(host,view);break;
    case 'steps':case 'timeline':steps(host,view);break;
    case 'choices':choices(host,view,context);break;
    case 'quiz':quiz(host,view);break;
    case 'chart':chart(host,view);break;
    case 'table':table(host,view);break;
    case 'diagram':diagram(host,view);break;
    case 'character':character(host,view,context);break;
  }
  return host;
}
function mount(article,row,context={}){
  if(!article||row?.role==='user')return false;
  const bubble=article.querySelector('.cw350-bubble');
  if(!bubble)return false;
  const parsed=extract(row?.text||''),text=parsed.text||(!parsed.views.length?String(row?.text||''):'');
  if(bubble.textContent!==text)bubble.textContent=text;
  let rail=article.querySelector('.cw350-visual-rail');
  if(!parsed.views.length){rail?.remove();return false;}
  const signature=JSON.stringify(parsed.views);
  if(rail?.dataset.signature===signature)return true;
  if(!rail){rail=element('div','cw350-visual-rail');bubble.parentElement.append(rail);}
  rail.dataset.signature=signature;rail.replaceChildren();
  installStyle();
  for(const view of parsed.views){const node=render(view,context);if(node)rail.append(node);}
  return true;
}
function tierFor(model=''){
  if(TINY.test(model))return'tiny';
  if(SMALL.test(model))return'small';
  return'full';
}
function promptFor({model='',tier='',system='',structured=false}={}){
  if(structured)return'';
  const selected=tier||tierFor(model),guide=s(system,35);
  if(selected==='tiny')return'Optional visual output tool for '+guide+': ONLY when helpful, append [[cw:meter|Label|value|max]] or [[cw:character|moss|curious|Short message]]. Otherwise answer normally. Never claim an action was performed.';
  const base='Optional Civweave visual-expression tool: If a visual really helps, place a fenced cw-view JSON object after your ordinary answer. The fence is three backticks plus cw-view, then JSON, then three backticks. Return no HTML, CSS, JS, URLs, executable code, or external assets. Visuals are display-only; buttons only prefill user messages. Do not include cw-view in machine-readable Quest/Learning Journey/Endeavor/Manifest JSON or other strict schemas. No more than 2 modules.';
  if(selected==='small')return base+' Use simple schemas only: {"type":"meter","title":"Progress","value":3,"max":5}, {"type":"steps","title":"Next steps","items":["First","Second"]}, {"type":"choices","title":"Choose","options":["Option A","Option B"]}, or {"type":"character","character":"'+guide+'","mood":"curious","speech":"A short thought"}. Use valid JSON.';
  return base+' Supported schemas: {"type":"chart","title":"Trend","labels":["A","B"],"values":[2,5]}, {"type":"table","title":"Comparison","headers":["A","B"],"rows":[["x","y"]]}, {"type":"cards","title":"Summary","items":[{"title":"One","body":"Detail"}]}, {"type":"quiz","question":"Which?","options":["A","B"],"answerIndex":1,"explanation":"Why"}, {"type":"diagram","title":"Flow","nodes":[{"label":"Input"},{"label":"Output"}]}, plus metric, meter, steps, timeline, choices and character. The face key for '+guide+' can be used in character. Make visual data accurate and grounded, not invented.';
}
const TOOL_MANIFEST=Object.freeze({
  name:'civweave.chat.visuals.v1',
  format:'cw-view fenced JSON or tiny [[cw:...]]',
  types:Object.freeze([...TYPES]),
  capabilities:Object.freeze(['visual-display','local-quiz','choice-prefill','accessible-charts','sprite-expression','thread-persistence']),
  permissions:'no-script-no-network-no-automatic-actions'
});
const api=Object.freeze({version:VERSION,manifest:TOOL_MANIFEST,tierFor,promptFor,parse,extract,valid,render,mount,installStyle});
globalThis.CivweaveChatVisualsV1=api;
try{dispatchEvent(new CustomEvent('civweave:chat-visual-tools-ready',{detail:{version:VERSION,manifest:TOOL_MANIFEST}}))}catch{}
})();
/**
 * Worldweaver avatar plan grammar and pure preview. No authority, AI inference,
 * arbitrary scripting, network access or host state mutation lives here.
 */
export const AVATAR_FORMAT='procedural-2d';
export const AVATAR_EVENTS=Object.freeze(['visitor-arrived','visitor-left','spoken-to','task-started','task-completed','idle']);
export const AVATAR_ACTIONS=Object.freeze(['pose','say']);
const SHAPES=new Set(['ellipse','circle','rectangle','capsule']);
const FIELD=(value,keys,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(label+' must be an object.');
  const extra=Object.keys(value).filter(key=>!keys.includes(key));
  if(extra.length)throw new TypeError('Unsupported field in '+label+': '+extra.join(', '));
};
const string=(v,max,label)=>{
  if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new TypeError(label+' must be bounded text.');
  return v.trim();
};
const number=(v,low,high,label)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<low||v>high)throw new TypeError(label+' outside allowed dimensions or rotation.');
  return v;
};
const copy=value=>JSON.parse(JSON.stringify(value));
const slug=x=>/^[a-z][a-z0-9-]{0,39}$/.test(x);
const hex=x=>typeof x==='string'&&/^#[0-9a-fA-F]{6}$/.test(x);
const id=x=>slug(x);
const MAX_PLAN_BYTES=24000;
export function validateAvatarPlan(raw){
  if(JSON.stringify(raw??{}).length>MAX_PLAN_BYTES)throw new TypeError('Avatar plan exceeds size limit.');
  FIELD(raw,['format','parts','poses','behaviors'],'avatar plan');
  if(raw.format!==AVATAR_FORMAT)throw new TypeError('Avatar format not supported.');
  if(!Array.isArray(raw.parts)||raw.parts.length<1||raw.parts.length>24)throw new TypeError('Avatar parts count must be between 1 and 24.');
  const ids=new Set(),parts=[];
  for(const p of raw.parts){
    FIELD(p,['id','parent','shape','x','y','width','height','color'],'avatar part');
    if(!id(p.id)||ids.has(p.id))throw new TypeError('Avatar part ID must be a unique slug.');
    if(p.parent!==null&&(!id(p.parent)||!ids.has(p.parent)))throw new TypeError('Avatar hierarchy parent must be an earlier part; no cycles.');
    if(!SHAPES.has(p.shape))throw new TypeError('Unsupported avatar part shape.');
    if(!hex(p.color))throw new TypeError('Avatar part color must be a hex color.');
    parts.push({id:p.id,parent:p.parent,shape:p.shape,x:number(p.x,-160,160,'x'),
      y:number(p.y,-160,160,'y'),width:number(p.width,1,160,'width'),
      height:number(p.height,1,160,'height'),color:p.color.toLowerCase()});
    ids.add(p.id);
  }
  if(!Array.isArray(raw.poses)||raw.poses.length<1||raw.poses.length>12)throw new TypeError('Avatar poses count must be between 1 and 12.');
  const poseIds=new Set(),poses=[];
  for(const p of raw.poses){
    FIELD(p,['name','rotations'],'avatar pose');
    if(!id(p.name)||poseIds.has(p.name))throw new TypeError('Avatar pose name must be unique.');
    if(!p.rotations||typeof p.rotations!=='object'||Array.isArray(p.rotations)||Object.keys(p.rotations).length>24)throw new TypeError('Avatar pose rotations must be a bounded map.');
    const rotations={};
    for(const [key,angle] of Object.entries(p.rotations)){
      if(!ids.has(key))throw new TypeError('Unknown avatar part in pose.');
      rotations[key]=number(angle,-180,180,'rotation');
    }
    poses.push({name:p.name,rotations});
    poseIds.add(p.name);
  }
  if(!poseIds.has('idle'))throw new TypeError('Avatar requires an idle pose.');
  if(!Array.isArray(raw.behaviors)||raw.behaviors.length>16)throw new TypeError('Avatar behaviors must be a bounded list.');
  const behaviors=raw.behaviors.map(b=>{
    FIELD(b,['on','action','value'],'avatar behavior');
    if(!AVATAR_EVENTS.includes(b.on)||!AVATAR_ACTIONS.includes(b.action))throw new TypeError('Unknown avatar behavior action or event.');
    const value=string(b.value,180,'Behavior value');
    if(b.action==='pose'&&!poseIds.has(value))throw new TypeError('Avatar behavior references unknown pose.');
    return {on:b.on,action:b.action,value};
  });
  return {format:AVATAR_FORMAT,parts,poses,behaviors};
}
/** A tiny, non-executable event script interpreter; returns UI effects only. */
export function avatarEventSteps(plan,event){
  const safe=validateAvatarPlan(plan);
  if(!AVATAR_EVENTS.includes(event))throw new TypeError('Unknown avatar event.');
  return safe.behaviors.filter(b=>b.on===event).map(b=>({...b}));
}
export function renderAvatarSvg(plan,{pose='idle'}={}){
  const safe=validateAvatarPlan(plan),selected=safe.poses.find(x=>x.name===pose);
  if(!selected)throw new TypeError('Unknown avatar pose.');
  const children=parent=>safe.parts.filter(p=>p.parent===parent).map(p=>{
    const a=selected.rotations[p.id]??0, w=p.width,h=p.height;
    const shape=p.shape==='ellipse'||p.shape==='circle'
      ?`<ellipse cx="0" cy="0" rx="${w/2}" ry="${(p.shape==='circle'?w:h)/2}" fill="${p.color}"/>`
      :`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${p.shape==='capsule'?w/2:0}" fill="${p.color}"/>`;
    return `<g transform="translate(${p.x} ${p.y}) rotate(${a})">${shape}${children(p.id)}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar pose ${pose}" viewBox="-128 -128 256 256"><g>${children(null)}</g></svg>`;
}
const dataImage=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
/**
 * Provider-neutral message content. Vision is true ONLY when actual raster image
 * bytes are provided by the trusted asset-rasterizer (SVG paths alone are not images
 * accepted by every model). Calling model adapters must check vision capability.
 */
export function avatarVisualRequest(seed,{rasterImageDataUri,task='Propose a usable avatar body, animation rig, and bounded behavior plan.'}={}){
  FIELD(seed,['personaId','name','role','description','referenceAsset','style','goal'],'avatar seed');
  const text=`Use the avatar image reference when supplied. Character: ${string(seed.name,100,'Name')} (${string(seed.role,180,'Role')}). Visual/textual description: ${string(seed.description,1200,'Description')}. ${string(task,600,'Task')} Respond with an avatar plan in the Worldweaver schema. Do not emit runnable JavaScript, LSL, network calls or external actions.`;
  const content=[{type:'text',text}];
  if(rasterImageDataUri!==undefined){
    if(typeof rasterImageDataUri!=='string'||rasterImageDataUri.length>2000000||!dataImage.test(rasterImageDataUri))
      throw new TypeError('A bounded PNG/JPEG/WebP raster image data URI is required (no remote or SVG image).');
    content.push({type:'image_url',image_url:{url:rasterImageDataUri}});
  }
  return {vision:content.length===2,content};
}
/**
 * On-demand, same-origin conversion for packaged Starling SVG portraits.
 * Browser-only. The SVG is not sent off-device: only the resulting raster data
 * can be passed to an explicitly selected, vision-capable model adapter.
 */
export async function rasterizeTrustedAvatar(seed,{fetchAsset=globalThis.fetch,documentRef=globalThis.document,
  imageFactory=()=>new Image(),urlApi=globalThis.URL,blobFactory=globalThis.Blob,size=384}={}){
  const asset=string(seed?.referenceAsset,200,'Avatar asset');
  if(!/^\/app\/assets\/starling\/[a-z][a-z0-9-]*\.svg$/.test(asset))throw new TypeError('Untrusted avatar source path.');
  if(!Number.isInteger(size)||size<64||size>512)throw new TypeError('Invalid portrait raster size.');
  if(typeof fetchAsset!=='function'||!documentRef?.createElement||!urlApi?.createObjectURL)throw new Error('Browser rasterizer unavailable.');
  const res=await fetchAsset(asset,{credentials:'same-origin',cache:'force-cache'});
  if(!res?.ok)throw new Error('Portrait could not be loaded from the installed assets.');
  const raw=await res.text();
  if(raw.length>250000||/<script\b|<foreignObject\b|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/i.test(raw))
    throw new TypeError('Portrait SVG failed local rasterization policy.');
  const url=urlApi.createObjectURL(new blobFactory([raw],{type:'image/svg+xml'}));
  try {
    const picture=imageFactory();
    await new Promise((resolve,reject)=>{
      picture.onload=resolve;
      picture.onerror=()=>reject(new Error('Portrait cannot be rasterized.'));
      picture.src=url;
    });
    const canvas=documentRef.createElement('canvas');
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas unavailable.');
    ctx.clearRect(0,0,size,size);
    ctx.drawImage(picture,0,0,size,size);
    const data=canvas.toDataURL('image/png');
    if(!dataImage.test(data)||data.length>2000000)throw new TypeError('Raster portrait exceeds vision input limits.');
    return data;
  }finally{urlApi.revokeObjectURL(url)}
}

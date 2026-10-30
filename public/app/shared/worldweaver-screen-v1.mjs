import {projectWorld2D,renderWorldMap2D} from './worldweaver-map-2d-v1.mjs';

/**
 * Portable, non-executable Worldweaver screen media grammar and DOM presenter.
 * Asset IDs are opaque: the canonical creator/library owner verifies and resolves
 * them in the trusted renderer. Remote URLs are not fetched by a server.
 */
export const WORLD_SCREEN_KINDS=Object.freeze(['image','video','website','civweave']);
const id=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/;
const own=(object,fields,label)=>{
  if(!object||typeof object!=='object'||Array.isArray(object))throw new TypeError(label+' must be an object.');
  const excess=Object.keys(object).filter(key=>!fields.includes(key));
  if(excess.length)throw new TypeError('Unsupported field in '+label+': '+excess.join(', '));
};
const text=(value,max,label)=>{
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new TypeError(label+' must be bounded text.');
  return value.trim();
};
export function safeWorldScreenUrl(value){
  const raw=text(value,1300,'HTTPS URL');
  let uri;
  try{uri=new URL(raw)}catch{throw new TypeError('Screen URLs must be valid HTTPS URLs.')}
  if(uri.protocol!=='https:')throw new TypeError('Screen URLs must use HTTPS.');
  if(uri.username||uri.password)throw new TypeError('Screen URLs cannot contain credentials.');
  if(uri.hash)throw new TypeError('Screen URLs cannot contain fragments.');
  if(uri.port)throw new TypeError('Screen URLs cannot use custom ports.');
  const host=uri.hostname.toLowerCase().replace(/\.$/,'');
  // URLs are displayed in a sandbox only; never proxy or server-fetch them.
  // No literal IPs, DNS special-use hosts, local domains, or obfuscated IP variants.
  if(!host||host.includes(':')||/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||
    host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
    host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.invalid')||
    !host.includes('.')||!(/^[a-z0-9.-]+$/.test(host))||host.includes('..'))
    throw new TypeError('Private/local address or unsupported host is not permitted.');
  return uri.href;
}
function assetSource(value){
  if(typeof value!=='string'||!id.test(value)||value.includes('..'))
    throw new TypeError('Screen asset ID must be a bounded canonical reference.');
  return value;
}
export function normalizeScreenContent(value){
  own(value,['kind','source','title','alt'],'screen content');
  if(!WORLD_SCREEN_KINDS.includes(value.kind))throw new TypeError('Unknown screen media kind.');
  own(value.source,value.kind==='civweave'?['worldRef']:['assetId','url'],'screen source');
  if(value.kind==='civweave'){
    if(Object.keys(value.source).length!==1||typeof value.source.worldRef!=='string'||
      !id.test(value.source.worldRef)||value.source.worldRef.includes('..'))
      throw new TypeError('Civweave screen requires exactly one bounded world reference.');
    const title=text(value.title,160,'Screen title');
    const alt=value.alt===undefined?'':text(value.alt,500,'Alt text');
    return {kind:'civweave',source:{worldRef:value.source.worldRef},title,...(alt?{alt}:{})};
  }
  const hasAsset=Object.hasOwn(value.source,'assetId');
  const hasUrl=Object.hasOwn(value.source,'url');
  if(hasAsset===hasUrl)throw new TypeError('Screen source requires exactly one asset ID or URL.');
  if(value.kind==='website'&&hasAsset)throw new TypeError('Website content requires an HTTPS URL.');
  const source=hasAsset?{assetId:assetSource(value.source.assetId)}:{url:safeWorldScreenUrl(value.source.url)};
  const title=text(value.title,160,'Screen title');
  const alt=value.alt===undefined?'':text(value.alt,500,'Alt text');
  return {kind:value.kind,source,title,...(alt?{alt}:{})};
}
/** Resolve an owned file through a trusted permission-checking asset adapter.
 * External HTTPS is permitted for URL sources. `blob:` may only come from a
 * trusted adapter for user-selected/locally generated assets on this device.
 */
export function resolveScreenSource(content,resolveAsset){
  const item=normalizeScreenContent(content);
  if(item.kind==='civweave')return {kind:'civweave',worldRef:item.source.worldRef,title:item.title,
    alt:item.alt||item.title,origin:'internal'};
  if(item.source.url)return {kind:item.kind,url:item.source.url,title:item.title,alt:item.alt||item.title,origin:'external'};
  if(typeof resolveAsset!=='function')throw new TypeError('A trusted screen asset resolver is required.');
  const record=resolveAsset(item.source.assetId,item.kind);
  if(record?.assetId!==item.source.assetId||record?.kind!==item.kind)
    throw new Error('The asset resolver did not verify this screen asset.');
  const url=record.url;
  if(typeof url!=='string'||url.length>1400)throw new TypeError('Unresolved screen asset.');
  if(!(/^\/app\/(?!\/)[a-zA-Z0-9_./-]+$/.test(url)&&!url.includes('..'))&&!/^blob:https?:\/\//.test(url))
    throw new TypeError('Asset resolver returned an unsupported URL.');
  return {kind:item.kind,url,title:item.title,alt:item.alt||item.title,origin:'owned'};
}
/**
 * Safe renderer. Screens never execute arbitrary model-provided HTML.
 * Websites receive opaque origin sandbox (no allow-same-origin), no top navigation,
 * no camera/microphone/geolocation/presentation, and a useful external link.
 * Third-party CSP/X-Frame-Options can still prevent embedded display.
 */
export function renderWorldScreen(content,{documentRef=globalThis.document,resolveAsset,worldState,onActivate}={}){
  const source=resolveScreenSource(content,resolveAsset);
  const map=source.kind==='civweave'?
    (worldState?projectWorld2D(worldState,{worldRef:source.worldRef}):null):null;
  const meta={...source,...(source.kind==='website'?{sandbox:'allow-scripts allow-forms'}:{}),
    ...(map?{mapSchema:map.schema,mapRevision:map.revision}:{} )};
  if(!documentRef?.createElement)return meta;
  const root=documentRef.createElement('section');
  root.className='cw-worldweaver-screen';root.setAttribute('aria-label',source.title);
  const header=documentRef.createElement('h3');header.textContent=source.title;root.append(header);
  let media;
  if(source.kind==='civweave'){
    if(!map){
      const placeholder=documentRef.createElement('p');
      placeholder.textContent='Civweave 2D world needs an authorized live Worldweaver state provider.';
      root.append(placeholder);
    }else{
      const portal=renderWorldMap2D(map,{documentRef,onActivate,embedded:true});
      // The embedded map *never* displays another full app iframe or nested
      // projector. In-map Weave screens become labeled one-depth portals.
      root.append(portal);
    }
    return root;
  }
  if(source.kind==='image'){
    media=documentRef.createElement('img');
    media.src=source.url;media.alt=source.alt;media.loading='lazy';
  }else if(source.kind==='video'){
    media=documentRef.createElement('video');
    media.controls=true;media.preload='metadata';media.playsInline=true;
    media.autoplay=false;media.src=source.url;media.setAttribute('aria-label',source.alt);
  }else{
    const warning=documentRef.createElement('p');
    warning.textContent='External website preview. This site may block embedding. For full functionality use Open website.';
    root.append(warning);
    media=documentRef.createElement('iframe');
    media.src=source.url;media.title=source.title;
    media.loading='lazy';media.referrerPolicy='no-referrer';
    media.setAttribute('sandbox','allow-scripts allow-forms');
    media.setAttribute('allow',''); // do not grant device features
    const link=documentRef.createElement('a');
    link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='Open website in a separate tab';
    root.append(link);
  }
  media.classList.add('cw-worldweaver-screen-media');
  root.append(media);
  return root;
}

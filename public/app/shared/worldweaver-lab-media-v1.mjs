/**
 * Standalone lab media inspection and object-URL lifecycle owner.
 * No uploads, inference, application credentials or media publishing.
 */
export const LAB_MEDIA_LIMITS=Object.freeze({image:12*1024*1024,video:50*1024*1024});
export const LAB_MAX_IMAGE_PIXELS=32*1024*1024;
export const LAB_MAX_IMAGE_EDGE=8192;
export const LAB_MAX_VIDEO_DURATION=300;
const TYPES=Object.freeze({
 'image/png':'image','image/jpeg':'image','image/webp':'image',
 'video/mp4':'video','video/webm':'video'
});
export function identifyMediaHeader(type,bytes){
 const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
 const at=(index,...v)=>v.every((n,j)=>a[index+j]===n);
 if(type==='image/png')return a.length>=24&&at(0,137,80,78,71,13,10,26,10);
 if(type==='image/jpeg')return a.length>=4&&at(0,255,216,255);
 if(type==='image/webp')return a.length>=16&&at(0,82,73,70,70)&&at(8,87,69,66,80);
 if(type==='video/mp4')return a.length>=16&&at(4,102,116,121,112);
 if(type==='video/webm')return a.length>=8&&at(0,26,69,223,163);
 return false;
}
/** Probes are environment adapters: the browser must decode actual dimensions
 * (and a known finite video duration) before any blob URL is retained.
 */
export async function validateLabMediaFile(file,kind,{probeImage,probeVideo}={}){
 if(!file||!Number.isSafeInteger(file.size)||file.size<=0||file.size>LAB_MEDIA_LIMITS[kind])
   throw new TypeError('Media exceeds the permitted local file size or is empty.');
 if(TYPES[file.type]!==kind)throw new TypeError('This file type cannot be shown as the selected media kind.');
 if(typeof file.slice!=='function')throw new TypeError('Media must be a browser File or Blob.');
 const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());
 if(!identifyMediaHeader(file.type,bytes))throw new TypeError('File signature does not match its declared image/video format.');
 if(kind==='image'){
   if(typeof probeImage!=='function')throw new Error('Image decoding and dimension checks are required.');
   const info=await probeImage(file);
   if(!Number.isSafeInteger(info?.width)||!Number.isSafeInteger(info?.height)||
     info.width<1||info.height<1||info.width>LAB_MAX_IMAGE_EDGE||info.height>LAB_MAX_IMAGE_EDGE||
     info.width*info.height>LAB_MAX_IMAGE_PIXELS)
     throw new TypeError('Image dimensions exceed allowed limits or decoding failed.');
   return {kind,type:file.type,size:file.size,width:info.width,height:info.height};
 }
 if(typeof probeVideo!=='function')throw new Error('Video metadata checks are required.');
 const info=await probeVideo(file);
 if(!Number.isFinite(info?.duration)||info.duration<=0||info.duration>LAB_MAX_VIDEO_DURATION)
   throw new TypeError('Video duration is unavailable or exceeds five minutes.');
 return {kind,type:file.type,size:file.size,duration:info.duration};
}
export async function probeBrowserImage(file,{createImageBitmapFn=globalThis.createImageBitmap}={}){
 if(typeof createImageBitmapFn!=='function')throw new Error('Image decoder is unavailable on this device.');
 const bitmap=await createImageBitmapFn(file);
 try{return {width:bitmap.width,height:bitmap.height}}
 finally{bitmap.close?.()}
}
export async function probeBrowserVideo(file,{documentRef=globalThis.document,urlApi=globalThis.URL,timeoutMs=8000}={}){
 if(!documentRef?.createElement||!urlApi?.createObjectURL)throw new Error('Video metadata probe unavailable.');
 const url=urlApi.createObjectURL(file),video=documentRef.createElement('video');
 try{
   video.preload='metadata';video.muted=true;video.playsInline=true;
   return await new Promise((resolve,reject)=>{
     let settled=false;
     const finish=(error,value)=>{
       if(settled)return;
       settled=true;clearTimeout(timer);
       if(error)reject(error);else resolve(value);
     };
     const timer=setTimeout(()=>finish(new Error('Video metadata timed out.')),timeoutMs);
     video.onloadedmetadata=()=>finish(null,{duration:video.duration});
     video.onerror=()=>finish(new Error('Video cannot be decoded.'));
     video.src=url;video.load();
   });
 }finally{
   video.pause?.();video.removeAttribute('src');video.load?.();
   urlApi.revokeObjectURL(url);
 }
}
/** Reference-aware local blob URL manager. Do not revoke assets still visible
 * on screen or referenced by a live model intent. Revoke all on pagehide.
 */
export function createLabMediaLeases({urlApi=globalThis.URL}={}){
 if(!urlApi?.createObjectURL||!urlApi?.revokeObjectURL)throw new Error('Object URL support unavailable.');
 const assets=new Map();
 let serial=0;
 return Object.freeze({
   add(blob,kind){
     if(!['image','video'].includes(kind))throw new TypeError('Unknown media kind.');
     const assetId='lab:media-'+(++serial);
     const url=urlApi.createObjectURL(blob);
     const row={assetId,url,kind};
     assets.set(assetId,row);
     return {...row};
   },
   resolve(assetId,kind){
     const row=assets.get(assetId);
     return row?.kind===kind?{...row}:null;
   },
   prune(keepIds=[]){
     const keep=new Set(keepIds);
     for(const [id,row] of assets)if(!keep.has(id)){
       urlApi.revokeObjectURL(row.url);assets.delete(id);
     }
     return assets.size;
   },
   dispose(){for(const row of assets.values())urlApi.revokeObjectURL(row.url);assets.clear();},
   get size(){return assets.size}
 });
}
/** Release media players before removing their DOM subtree. */
export function stopLabMedia(root){
 if(!root?.querySelectorAll)return;
 for(const video of root.querySelectorAll('video')){
   video.pause?.();
   video.removeAttribute?.('src');
   video.load?.();
 }
 for(const frame of root.querySelectorAll('iframe'))frame.removeAttribute?.('src');
}

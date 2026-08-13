(()=>{
'use strict';

const VERSION='1.0.0-avatar-expression-assets-v315-rle';
const MANIFEST_URL='/app/assets/ai/chat/expressions/rle-v315/manifest.json';
if(globalThis.CivweaveAvatarExpressionAssetsV315?.version===VERSION)return;

let manifestPromise=null;
const rowPromises=new Map();
const assetPromises=new Map();
const clean=value=>String(value??'').trim().toLowerCase();

async function fetchJson(url){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error(`Avatar expression asset ${url} returned HTTP ${response.status}.`);
  return response.json();
}
function manifest(){return manifestPromise||(manifestPromise=fetchJson(MANIFEST_URL).catch(error=>{manifestPromise=null;throw error}))}
async function rowFor(character,row){
  const data=await manifest(),entry=data.characters?.[character];
  if(!entry)throw new Error(`Unknown avatar character: ${character}`);
  const filename=entry.parts?.[row];
  if(!filename)throw new Error(`Missing avatar RLE row ${row} for ${character}.`);
  const key=`${character}:${row}`;
  if(!rowPromises.has(key))rowPromises.set(key,fetchJson(`/app/assets/ai/chat/expressions/rle-v315/${filename}`).catch(error=>{rowPromises.delete(key);throw error}));
  return rowPromises.get(key);
}
function rgba(tuple){const [r=0,g=0,b=0,a=255]=tuple||[];return `rgba(${r},${g},${b},${Math.max(0,Math.min(255,a))/255})`}
async function render(character,index){
  const data=await manifest(),entry=data.characters?.[character];
  if(!entry)throw new Error(`Unknown avatar character: ${character}`);
  const columns=Math.max(1,Number(data.columns||5)),rows=Math.max(1,Number(data.rows||4));
  const cellWidth=Math.max(1,Number(data.cellWidth||32)),cellHeight=Math.max(1,Number(data.cellHeight||27));
  const safeIndex=Math.max(0,Math.min(columns*rows-1,Number(index)||0));
  const row=Math.floor(safeIndex/columns),column=safeIndex%columns,rowData=await rowFor(character,row);
  const canvas=document.createElement('canvas');canvas.width=cellWidth;canvas.height=cellHeight;
  const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('Avatar expression canvas is unavailable.');
  context.clearRect(0,0,cellWidth,cellHeight);
  const x0=column*cellWidth,y0=row*cellHeight,runs=Array.isArray(rowData.runs)?rowData.runs:[],palette=entry.palette||[];
  for(let cursor=0;cursor+3<runs.length;cursor+=4){
    const paletteIndex=Number(runs[cursor]),x=Number(runs[cursor+1]),y=Number(runs[cursor+2]),length=Math.max(0,Number(runs[cursor+3])||0);
    if(y<y0||y>=y0+cellHeight||x+length<=x0||x>=x0+cellWidth||!palette[paletteIndex])continue;
    const left=Math.max(x,x0),right=Math.min(x+length,x0+cellWidth);if(right<=left)continue;
    context.fillStyle=rgba(palette[paletteIndex]);context.fillRect(left-x0,y-y0,right-left,1);
  }
  return canvas.toDataURL('image/png');
}
function dataUrlFor(character,index){
  character=clean(character);const key=`${character}:${Math.max(0,Number(index)||0)}`;
  if(!assetPromises.has(key))assetPromises.set(key,render(character,index).catch(error=>{assetPromises.delete(key);throw error}));
  return assetPromises.get(key);
}
function clear(){manifestPromise=null;rowPromises.clear();assetPromises.clear()}
const api=Object.freeze({version:VERSION,manifestUrl:MANIFEST_URL,dataUrlFor,clear,transparent:true,delivery:'palette-rle-to-png',cell:{width:32,height:27,columns:5,rows:4}});
globalThis.CivweaveAvatarExpressionAssetsV315=api;
try{dispatchEvent(new CustomEvent('civweave:avatar-expression-assets-ready',{detail:{version:VERSION,transparent:true}}))}catch{}
})();

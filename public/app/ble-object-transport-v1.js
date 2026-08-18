(()=>{
'use strict';
const VERSION='1.0.0-ble-object-transport-v1';
const SERVICE_UUID='7f3c2d10-8a24-4f6a-9b31-4d7f6c697665';
const RX_UUID='7f3c2d11-8a24-4f6a-9b31-4d7f6c697665';
const TX_UUID='7f3c2d12-8a24-4f6a-9b31-4d7f6c697665';
const PROTOCOL='civweave.ble-object-frame.v1';
const FRAME_VERSION=1;
const HEADER_BYTES=8;
const PAYLOAD_BYTES=12;
const MAX_OBJECT_BYTES=96*1024;
const SENT_KEY='civweave.ble-object-sent.v1';
const DEFAULT_KINDS=new Set(['civweave.private-message-envelope.v1']);
if(globalThis.CivweaveBleObjectTransportV1?.version===VERSION)return;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const peers=new Map(),incoming=new Map(),extraKinds=new Set();
let meshPromise=null,nativeBound=false,nativeStarted=false,flushTimer=0;
const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const b64=bytes=>{let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64=value=>{const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,c=>c.charCodeAt(0))};
function ensureMesh(){
  if(globalThis.CivweaveLocalMeshV146)return Promise.resolve(globalThis.CivweaveLocalMeshV146);
  if(meshPromise)return meshPromise;
  meshPromise=new Promise((resolve,reject)=>{const path='/app/local-object-mesh-v146.js',existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}}),finish=()=>globalThis.CivweaveLocalMeshV146?resolve(globalThis.CivweaveLocalMeshV146):reject(new Error('Local object mesh did not become ready.'));if(existing){existing.addEventListener('load',finish,{once:true});setTimeout(finish,1600);return}const script=document.createElement('script');script.src=path+'?v=ble-object-transport-v1';script.async=false;script.onload=finish;script.onerror=()=>reject(new Error('Local object mesh could not load.'));document.head?.append(script)}).catch(error=>{meshPromise=null;throw error});return meshPromise
}
function nativeBridge(){return globalThis.CivweaveAndroidBleMesh||globalThis.CivweaveNativeBleMeshV1||null}
function webSupported(){return Boolean(navigator.bluetooth?.requestDevice)}
function sentState(){try{const value=parse(localStorage.getItem(SENT_KEY),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function saveSent(value){const cutoff=Date.now()-3*24*60*60*1000,out={};for(const [key,row] of Object.entries(value||{}))if(Date.parse(row?.at||0)>cutoff)out[key]=row;try{localStorage.setItem(SENT_KEY,JSON.stringify(out))}catch{}return out}
function sentKey(peerId,object){return`${peerId}|${object.id}|${object.revisionHash}`}
function alreadySent(peerId,object){return Boolean(sentState()[sentKey(peerId,object)])}
function markSent(peerId,object){const state=sentState();state[sentKey(peerId,object)]={at:now()};saveSent(state)}
function allowedKind(kind){return DEFAULT_KINDS.has(kind)||extraKinds.has(kind)}
function frameTransfer(bytes){const transferId=crypto.getRandomValues(new Uint16Array(1))[0]||1,total=Math.ceil(bytes.byteLength/PAYLOAD_BYTES);if(total>65535)throw new Error('BLE object exceeds frame count limit.');const frames=[];for(let index=0;index<total;index++){const start=index*PAYLOAD_BYTES,payload=bytes.slice(start,Math.min(bytes.byteLength,start+PAYLOAD_BYTES)),frame=new Uint8Array(HEADER_BYTES+payload.byteLength),view=new DataView(frame.buffer);frame[0]=FRAME_VERSION;frame[1]=index===total-1?1:0;view.setUint16(2,transferId);view.setUint16(4,index);view.setUint16(6,total);frame.set(payload,HEADER_BYTES);frames.push(frame)}return{transferId,total,frames}}
async function ingestFrame(peerId,frameLike){
  const frame=frameLike instanceof Uint8Array?frameLike:new Uint8Array(frameLike?.buffer||frameLike||[]);if(frame.byteLength<HEADER_BYTES||frame[0]!==FRAME_VERSION)return false;const view=new DataView(frame.buffer,frame.byteOffset,frame.byteLength),transferId=view.getUint16(2),index=view.getUint16(4),total=view.getUint16(6);if(!total||index>=total)return false;const key=`${peerId}:${transferId}`,row=incoming.get(key)||{total,chunks:new Map(),bytes:0,createdAt:Date.now()};if(row.total!==total){incoming.delete(key);return false}const payload=frame.slice(HEADER_BYTES);if(!row.chunks.has(index)){row.chunks.set(index,payload);row.bytes+=payload.byteLength}if(row.bytes>MAX_OBJECT_BYTES){incoming.delete(key);return false}incoming.set(key,row);if(row.chunks.size<total)return true;incoming.delete(key);const out=new Uint8Array([...row.chunks.values()].reduce((sum,chunk)=>sum+chunk.byteLength,0));let offset=0;for(let i=0;i<total;i++){const chunk=row.chunks.get(i);if(!chunk)return false;out.set(chunk,offset);offset+=chunk.byteLength}let object=null;try{object=JSON.parse(decoder.decode(out))}catch{return false}if(!allowedKind(object?.kind))return false;const mesh=await ensureMesh(),localNodeId=await mesh.deviceId?.();try{const result=await mesh.ingest(object,{fromPeer:`ble:${peerId}`,localNodeId});try{dispatchEvent(new CustomEvent('civweave:ble-object-received',{detail:{peerId,id:object.id,kind:object.kind,status:result?.status||'accepted'}}))}catch{}return true}catch{return false}
}
function cleanupIncoming(){const cutoff=Date.now()-2*60*1000;for(const [key,row] of incoming)if(row.createdAt<cutoff)incoming.delete(key)}
async function candidateObjects(peerId){const mesh=await ensureMesh(),objects=await mesh.listObjects?.()||[],rows=[];for(const object of objects){if(!object?.id||!object.revisionHash||!allowedKind(object.kind))continue;if(object.expiresAt&&Date.parse(object.expiresAt)<=Date.now())continue;if((object.visited||[]).includes(`ble:${peerId}`))continue;if(alreadySent(peerId,object))continue;const bytes=encoder.encode(JSON.stringify(object));if(bytes.byteLength>MAX_OBJECT_BYTES)continue;rows.push({object,bytes,priority:object.kind==='civweave.private-message-envelope.v1'?90:60})}rows.sort((a,b)=>b.priority-a.priority||String(a.object.createdAt||'').localeCompare(String(b.object.createdAt||'')));return rows.slice(0,24)}
async function sendFrames(peer,frames){for(const frame of frames)await peer.write(frame)}
async function flushPeer(peerId){const peer=peers.get(peerId);if(!peer||peer.state!=='open')return{sent:0};let sent=0,frames=0;for(const row of await candidateObjects(peerId)){const transfer=frameTransfer(row.bytes);try{await sendFrames(peer,transfer.frames);markSent(peerId,row.object);sent++;frames+=transfer.total}catch(error){peer.lastError=clean(error?.message||error,300);break}}peer.lastSyncAt=now();try{dispatchEvent(new CustomEvent('civweave:ble-peer-flush',{detail:{peerId,sent,frames}}))}catch{}return{sent,frames}}
async function flushAll(){cleanupIncoming();const results=[];for(const peerId of peers.keys())try{results.push({peerId,...await flushPeer(peerId)})}catch(error){results.push({peerId,error:clean(error?.message||error,300)})}return results}
function bindNative(){
  const bridge=nativeBridge();if(!bridge||nativeBound)return Boolean(bridge);nativeBound=true;
  addEventListener('civweave:native-ble-frame',event=>{const peerId=clean(event?.detail?.peerId||'native',180),data=event?.detail?.base64||event?.detail?.data;if(data)void ingestFrame(peerId,unb64(data))});
  addEventListener('civweave:native-ble-peer',event=>{const peerId=clean(event?.detail?.peerId,180);if(!peerId)return;if(event.detail.state==='closed'||event.detail.state==='disconnected'){peers.delete(peerId);return}peers.set(peerId,{id:peerId,type:'native',state:'open',write:async frame=>{const result=bridge.send?.(peerId,b64(frame));if(result&&typeof result.then==='function')await result;else if(result===false)throw new Error('Native BLE bridge rejected frame.')}});void flushPeer(peerId)});
  return true
}
async function startNative(){const bridge=nativeBridge();if(!bridge)return{ok:false,reason:'native bridge unavailable'};bindNative();const mesh=await ensureMesh(),nodeId=await mesh.deviceId?.(),config={protocol:PROTOCOL,serviceUuid:SERVICE_UUID,rxUuid:RX_UUID,txUuid:TX_UUID,nodeId,frameBytes:HEADER_BYTES+PAYLOAD_BYTES};let result=bridge.start?.(JSON.stringify(config));if(result&&typeof result.then==='function')result=await result;nativeStarted=result!==false;return{ok:nativeStarted,result:result??null}}
async function connectWebPeer(){
  if(!webSupported())throw new Error('Web Bluetooth is unavailable in this browser.');const device=await navigator.bluetooth.requestDevice({filters:[{services:[SERVICE_UUID]}],optionalServices:[SERVICE_UUID]}),server=await device.gatt.connect(),service=await server.getPrimaryService(SERVICE_UUID),rx=await service.getCharacteristic(RX_UUID),tx=await service.getCharacteristic(TX_UUID),peerId=`web:${device.id}`;
  await tx.startNotifications();tx.addEventListener('characteristicvaluechanged',event=>{const value=event.target.value,bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);void ingestFrame(peerId,bytes)});
  const write=async frame=>{if(typeof rx.writeValueWithoutResponse==='function')await rx.writeValueWithoutResponse(frame);else await rx.writeValue(frame)};
  peers.set(peerId,{id:peerId,type:'web-central',name:device.name||'Civweave peer',state:'open',device,server,rx,tx,write});device.addEventListener('gattserverdisconnected',()=>{const peer=peers.get(peerId);if(peer)peer.state='closed';try{dispatchEvent(new CustomEvent('civweave:ble-peer',{detail:{peerId,state:'closed',type:'web-central'}}))}catch{}});try{dispatchEvent(new CustomEvent('civweave:ble-peer',{detail:{peerId,state:'open',type:'web-central',name:device.name||''}}))}catch{}await flushPeer(peerId);return{peerId,name:device.name||'',type:'web-central'}
}
function disconnect(peerId){const peer=peers.get(peerId);try{peer?.device?.gatt?.disconnect?.()}catch{}peers.delete(peerId);return true}
function registerKind(kind){const value=clean(kind,160);if(value)extraKinds.add(value);return[...extraKinds]}
function status(){const bridge=nativeBridge();return{version:VERSION,protocol:PROTOCOL,serviceUuid:SERVICE_UUID,frameBytes:HEADER_BYTES+PAYLOAD_BYTES,payloadBytes:PAYLOAD_BYTES,maxObjectBytes:MAX_OBJECT_BYTES,webBluetooth:{central:webSupported(),peripheral:false,requiresUserDeviceChooser:true},native:{available:Boolean(bridge),started:nativeStarted,peripheral:Boolean(bridge),advertising:Boolean(bridge&&nativeStarted)},meshMode:'store-carry-forward-e2ee-object-gossip',defaultKinds:[...DEFAULT_KINDS],extraKinds:[...extraKinds],peers:[...peers.values()].map(peer=>({id:peer.id,type:peer.type,name:peer.name||'',state:peer.state,lastSyncAt:peer.lastSyncAt||null,lastError:peer.lastError||null}))}}
async function boot(){await ensureMesh().catch(()=>null);bindNative();if(nativeBridge())await startNative().catch(()=>null);addEventListener('online',()=>void flushAll());addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void flushAll()});addEventListener('civweave:private-message',()=>void flushAll());addEventListener('civweave:mesh',event=>{if(['object-created','object-received','queued'].includes(event?.detail?.type))void flushAll()});flushTimer=setInterval(()=>void flushAll(),45_000);addEventListener('pagehide',()=>clearInterval(flushTimer),{once:true});try{dispatchEvent(new CustomEvent('civweave:ble-object-transport-ready',{detail:status()}))}catch{}}
const api=Object.freeze({version:VERSION,protocol:PROTOCOL,serviceUuid:SERVICE_UUID,rxUuid:RX_UUID,txUuid:TX_UUID,startNative,connectWebPeer,disconnect,flushPeer,flushAll,ingestFrame,registerKind,status,actualBrowserPeripheral:false,nativePeripheralBridge:true,storeCarryForward:true});globalThis.CivweaveBleObjectTransportV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>void boot(),{once:true});else void boot();
})();
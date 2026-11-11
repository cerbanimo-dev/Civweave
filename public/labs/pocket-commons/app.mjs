import {
  FRAME,
  fragmentPayload,
  decodeFrame,
  reassembleFrames,
  createPet,
  applyPetEvent,
} from './core.mjs';

const canvas = document.querySelector('#screen');
const ctx = canvas.getContext('2d');
const out = document.querySelector('#transport-output');
const textarea = document.querySelector('#demo-message');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let pet = createPet('thread-9');
let signal = 'SIM';
let pulse = 0;

function px(x,y,w,h,fill){ctx.fillStyle=fill;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function text(value,x,y,size=8,fill='#eff9ff',align='left'){
  ctx.fillStyle=fill;ctx.font=`700 ${size}px monospace`;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(value,x,y)
}
function bar(label,value,y,fill){
  text(label,8,y,6,'#a9c3d8');
  px(42,y+1,82,5,'#203746');
  px(42,y+1,82*(value/100),5,fill);
}

function drawThreadling(){
  const bob = Math.round(Math.sin(pulse/9)*2);
  const x=67,y=94+bob;
  // shadow
  px(x-24,y+35,48,5,'#0b1a24');
  // ears / yarn tufts
  px(x-21,y-25,8,15,'#b6a1ff');px(x+13,y-25,8,15,'#8fe7ff');
  px(x-15,y-31,8,15,'#ff9ccf');px(x+7,y-31,8,15,'#ffd28f');
  // body
  px(x-22,y-13,44,48,'#6fd7d0');
  px(x-18,y-18,36,10,'#8fe7ff');
  px(x-15,y+30,10,10,'#6fd7d0');px(x+5,y+30,10,10,'#6fd7d0');
  // face
  px(x-12,y-2,6,6,'#0b1721');px(x+6,y-2,6,6,'#0b1721');
  px(x-7,y+10,14,3,'#19313e');
  // scarf / carried mail
  px(x-25,y+10,50,5,'#7e5cff');
  if(pet.carried){
    px(x+20,y+13,18,13,'#f3d782');px(x+23,y+16,12,2,'#72501f');
  }
  if(pet.mood==='sleepy'){px(x-12,y,7,2,'#0b1721');px(x+5,y,7,2,'#0b1721')}
  if(pet.mood==='spark'){px(x-33,y-8,4,4,'#fff1a8');px(x+29,y-18,4,4,'#fff1a8')}
}

function render(){
  pulse += 1;
  ctx.clearRect(0,0,135,240);
  px(0,0,135,240,'#112a38');
  px(0,0,135,22,'#09141d');
  text('POCKET COMMONS',7,6,7,'#bdf6ff');
  text(signal,127,6,7,signal==='SIM'?'#f3d782':'#7ff3b0','right');
  drawThreadling();
  text(pet.variant.toUpperCase()+' THREADLING',67,145,7,'#f8f2ff','center');
  text(pet.mood.toUpperCase(),67,156,7,'#8fe7ff','center');
  bar('ENERGY',pet.energy,175,'#7ff3b0');
  bar('CURIOUS',pet.curiosity,186,'#f3d782');
  bar('TRUST',pet.trust,197,'#b6a1ff');
  text(`XP ${pet.xp}`,8,211,7,'#d7e6f2');
  text(`MAIL ${pet.carried}`,127,211,7,'#d7e6f2','right');
  px(0,225,135,15,'#09141d');
  text('A MEET',7,230,6,'#bdf6ff');
  text('B DELIVER',128,230,6,'#bdf6ff','right');
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function act(type){
  pet=applyPetEvent(pet,{type});
  if(type==='encounter') out.textContent=`ENCOUNTER · Threadling noticed a nearby peer · total ${pet.encounters}`;
  if(type==='carry') out.textContent=`OUTBOX · carrying ${pet.carried} packet${pet.carried===1?'':'s'}`;
  if(type==='deliver') out.textContent=pet.delivered?`DELIVERED · trust ${Math.round(pet.trust)} · XP ${pet.xp}`:'NOTHING TO DELIVER';
  if(type==='rest') out.textContent=`REST · energy ${Math.round(pet.energy)}%`;
}
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>act(button.dataset.action)));

document.querySelector('#frame-message').addEventListener('click',()=>{
  const source=encoder.encode(textarea.value || '');
  const messageId=(Date.now()>>>0);
  const encoded=fragmentPayload(source,{messageId,flags:FRAME.flags.encryptedEnvelope});
  const decoded=encoded.map(decodeFrame);
  const rebuilt=reassembleFrames(decoded);
  act('carry');
  out.textContent=[
    'SIM ONLY · no radio transmission',
    `message ${messageId.toString(16).padStart(8,'0')} · ${source.length} bytes`,
    `${encoded.length} frame${encoded.length===1?'':'s'} · max payload ${FRAME.maxPayload} bytes`,
    `round-trip: ${decoder.decode(rebuilt)===textarea.value?'PASS':'FAIL'}`,
  ].join('\n');
});

document.querySelector('#corrupt-frame').addEventListener('click',()=>{
  const frame=fragmentPayload(encoder.encode('tamper test'),{messageId:0x9999,flags:FRAME.flags.beacon})[0];
  frame[frame.length-1]^=0xff;
  try{decodeFrame(frame);out.textContent='CRC TEST FAILED · corruption was accepted'}
  catch(error){out.textContent=`CRC TEST PASS · ${error.message}`}
});

setInterval(()=>{pet=applyPetEvent(pet,{type:'tick'})},4000);

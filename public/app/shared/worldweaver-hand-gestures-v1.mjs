/**
 * Headset-independent hand gesture vocabulary for a future OpenXR adapter.
 * Input is normalized, local-only joint tracking; raw hand data never needs
 * to leave the device. These functions do NOT acquire XR tracking themselves.
 */
export const HAND_GESTURES=Object.freeze(['five_point_convergence','telephone_sign']);
export const HAND_SURFACE_ANCHORS=Object.freeze({
 left:Object.freeze({topLeft:'index.tip',bottomLeft:'pinky.base'}),
 right:Object.freeze({topLeft:'pinky.tip',bottomLeft:'index.base'})
});
const FINGERS=['index','middle','ring','pinky'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const point=p=>p&&[p.x,p.y,p.z??0].every(Number.isFinite);
export function recognizeHandGesture(hand){
 if(!hand||!Number.isFinite(hand.palmWidth)||hand.palmWidth<=0)return null;
 const fingers=hand.fingers;
 if(!fingers||!FINGERS.every(key=>point(fingers[key]?.tip)&&Number.isFinite(fingers[key]?.curl))||
  !point(fingers.thumb?.tip)||!Number.isFinite(fingers.thumb?.curl))return null;
 const thumb=fingers.thumb;
 const allMeet=FINGERS.every(key=>distance(thumb.tip,fingers[key].tip)<=hand.palmWidth*.32);
 if(allMeet)return 'five_point_convergence';
 const closed=['index','middle','ring'].every(key=>fingers[key].curl>=.72);
 const extended=thumb.curl<=.3&&fingers.pinky.curl<=.3;
 return closed&&extended?'telephone_sign':null;
}
export function createHandGestureInterpreter({activationFrames=4,releaseFrames=3}={}){
 if(!Number.isInteger(activationFrames)||activationFrames<2||activationFrames>30||
    !Number.isInteger(releaseFrames)||releaseFrames<1||releaseFrames>30)
  throw new TypeError('Invalid gesture hysteresis');
 const records={left:{candidate:null,frames:0,active:null,release:0},
  right:{candidate:null,frames:0,active:null,release:0}};
 function update(side,frame){
  if(!records[side])throw new TypeError('Hand side must be left or right');
  const s=records[side],pose=recognizeHandGesture(frame);
  if(s.active){
   if(pose===s.active){s.release=0;return null}
   if(++s.release<releaseFrames)return null;
   s.active=null;s.release=0;s.candidate=null;s.frames=0;
  }
  if(!pose){s.candidate=null;s.frames=0;return null}
  if(pose===s.candidate)s.frames++;else{s.candidate=pose;s.frames=1}
  if(s.frames<activationFrames)return null;
  s.active=pose;s.frames=0;
  return pose==='telephone_sign'
   ?Object.freeze({type:'civweave.phone.summon',sourceHand:side,destinationHand:side==='left'?'right':'left',screen:'civweave.core.home'})
   :Object.freeze({type:'civweave.menu.toggle',sourceHand:side});
 }
 return Object.freeze({update,reset(){for(const r of Object.values(records)){r.candidate=null;r.frames=0;r.active=null;r.release=0}}});
}

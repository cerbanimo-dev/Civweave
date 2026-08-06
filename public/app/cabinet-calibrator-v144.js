(()=>{
'use strict';
const runtime=globalThis.CivweaveCabinetCalibrationV144;
const KEY=runtime?.key||'civweave.cabinet-calibration.v144';
const ORDER=['anarchadia','fellowfare','civweave','living-school','cerbanimo'];
const NAMES={anarchadia:'Anarchadia',fellowfare:'FellowFare',civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo'};
const params=new URLSearchParams(location.search);
const $=selector=>document.querySelector(selector);
const clone=value=>JSON.parse(JSON.stringify(value));
let shells={},state=clone(runtime?.current||runtime?.defaults||{systems:{}}),systemId=params.get('system')||'civweave',selected=-1,drag=null,renderFrame=0;
function current(){return state.systems[systemId]}
function artFor(){return shells[systemId]?.asset||`/app/assets/cabinets/${systemId}.webp`}
function point(event){const svg=$('#cc144-overlay'),matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const source=typeof DOMPoint==='function'?new DOMPoint(event.clientX,event.clientY):svg.createSVGPoint();source.x=event.clientX;source.y=event.clientY;const p=source.matrixTransform(matrix.inverse());return{x:p.x,y:p.y}}
function rounded(value){return Math.round(Number(value)*10)/10}
function scheduleRender(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(render)}
function render(){
  const config=current();if(!config)return;
  const size=config.sourceSize||state.sourceSize||{width:941,height:1672};
  $('#cc144-overlay').setAttribute('viewBox',`0 0 ${size.width} ${size.height}`);
  $('#cc144-art').src=artFor();
  $('#cc144-open').href=`/app/cabinet-mode-v142.html?system=${encodeURIComponent(systemId)}`;
  $('#cc144-overlay').innerHTML=(config.hotspots||[]).map((spot,index)=>`<g data-index="${index}"><circle class="cc144-hotspot ${index===selected?'is-selected':''}" data-index="${index}" cx="${spot.cx}" cy="${spot.cy}" r="${spot.r}"></circle>${index===selected?`<circle class="cc144-radius-guide" cx="${spot.cx}" cy="${spot.cy}" r="${spot.r}"></circle><circle class="cc144-center" cx="${spot.cx}" cy="${spot.cy}" r="5"></circle>`:''}<text class="cc144-label" x="${spot.cx}" y="${Number(spot.cy)-Number(spot.r)-13}">${index+1}</text></g>`).join('');
  syncFields();
}
function syncFields(){
  const spot=current()?.hotspots?.[selected];
  const disabled=!spot;
  for(const node of [$('#cc144-x'),$('#cc144-y'),$('#cc144-r'),$('#cc144-r-number')])node.disabled=disabled;
  if(!spot){$('#cc144-selected').textContent='Select a circle in the artwork.';return}
  $('#cc144-selected').textContent=`${selected+1}. ${NAMES[spot.system]||spot.system}`;
  $('#cc144-x').value=rounded(spot.cx);$('#cc144-y').value=rounded(spot.cy);$('#cc144-r').value=rounded(spot.r);$('#cc144-r-number').value=rounded(spot.r);
}
function select(index){selected=Number(index);render()}
function updateSelected(patch){const spot=current()?.hotspots?.[selected];if(!spot)return;Object.assign(spot,patch);render()}
function status(message){$('#cc144-status').textContent=message}
function save(){state.userModifiedAt=new Date().toISOString();state.revision='source-svg-r24-user';localStorage.setItem(KEY,JSON.stringify(state));if(runtime)runtime.current=state;status(`${NAMES[systemId]} calibration saved on this device.`)}
function reset(){const defaults=runtime?.defaults?.systems?.[systemId];if(!defaults)return;state.systems[systemId]=clone(defaults);selected=-1;save();render();status(`${NAMES[systemId]} restored to shipped calibration.`)}
function exported(){return JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)}
async function copy(){try{await navigator.clipboard.writeText(exported());status('Calibration JSON copied.')}catch{status('Clipboard permission was unavailable. Use Export JSON instead.')}}
function download(){const blob=new Blob([exported()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='civweave-cabinet-calibration-v144.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Calibration JSON exported.')}
function fillSystems(){const select=$('#cc144-system');select.innerHTML=ORDER.map(id=>`<option value="${id}">${NAMES[id]}</option>`).join('');select.value=systemId;select.addEventListener('change',()=>{systemId=select.value;selected=-1;history.replaceState(null,'',`/app/cabinet-calibrator-v144.html?system=${encodeURIComponent(systemId)}`);render()})}
$('#cc144-overlay').addEventListener('pointerdown',event=>{const target=event.target.closest('.cc144-hotspot');if(!target)return;event.preventDefault();select(target.dataset.index);const spot=current().hotspots[selected],p=point(event);drag={pointerId:event.pointerId,dx:p.x-spot.cx,dy:p.y-spot.cy};document.body.setPointerCapture?.(event.pointerId)});
addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();const p=point(event),size=current().sourceSize||state.sourceSize,spot=current().hotspots[selected];spot.cx=Math.max(0,Math.min(size.width,rounded(p.x-drag.dx)));spot.cy=Math.max(0,Math.min(size.height,rounded(p.y-drag.dy)));scheduleRender()},{passive:false});
function endDrag(event){if(drag&&event.pointerId===drag.pointerId){document.body.releasePointerCapture?.(event.pointerId);drag=null;status('Position adjusted. Save when the ring matches the artwork.')}}
addEventListener('pointerup',endDrag);addEventListener('pointercancel',endDrag);
$('#cc144-x').addEventListener('input',event=>updateSelected({cx:rounded(event.target.value)}));
$('#cc144-y').addEventListener('input',event=>updateSelected({cy:rounded(event.target.value)}));
for(const id of ['#cc144-r','#cc144-r-number'])$(id).addEventListener('input',event=>updateSelected({r:Math.max(12,rounded(event.target.value))}));
$('#cc144-save').addEventListener('click',save);$('#cc144-reset').addEventListener('click',reset);$('#cc144-copy').addEventListener('click',copy);$('#cc144-export').addEventListener('click',download);
(async()=>{try{shells=await fetch('/app/shared/cabinet-shells-v129.json',{cache:'force-cache'}).then(response=>response.json()).then(value=>value.systems||{});fillSystems();render()}catch(error){status(`Calibrator could not open: ${error.message}`)}})();
})();

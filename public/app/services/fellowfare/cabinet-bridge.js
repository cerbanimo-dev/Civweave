const ORIGIN=location.origin;
const STORE_KEY='fellowfare.mvp.state.v3';
const routeButton=route=>document.querySelector(`[data-route="${CSS.escape(route)}"]`);
function route(route){const button=routeButton(route);if(button){button.click();return true}location.hash=route;return false}
function syntheticComposer(mode='need',text=''){route('market');requestAnimationFrame(()=>{const trigger=document.createElement('button');trigger.type='button';trigger.dataset.openComposer=['offer','collective'].includes(mode)?mode:'need';trigger.hidden=true;document.body.append(trigger);trigger.click();trigger.remove();requestAnimationFrame(()=>{const input=document.querySelector('#naturalInput');if(input&&text)input.value=String(text).slice(0,4000)})})}
function command(name,payload={}){if(name==='compose'){syntheticComposer(payload.mode,payload.text||'');return}if(['market','loom','assemblies','inbox','profile'].includes(name)){route(name);return}route('market')}
function removeSceneArt(){document.querySelectorAll('.ff-route-scene-art').forEach(node=>node.remove())}
new MutationObserver(removeSceneArt).observe(document.documentElement,{childList:true,subtree:true});removeSceneArt();
addEventListener('message',event=>{if(event.origin!==ORIGIN||event.source!==parent||!event.data||typeof event.data!=='object')return;if(event.data.type==='fellowfare:cabinet-command')command(String(event.data.command||'market'),event.data.payload||{})});
addEventListener('storage',event=>{if(event.key===STORE_KEY&&event.newValue!==event.oldValue)location.reload()});
addEventListener('DOMContentLoaded',()=>{document.body.classList.add('ff-cabinet-embedded');if(!['market','loom','assemblies','inbox','profile'].includes(location.hash.slice(1)))location.hash='market';route('market');parent.postMessage({type:'fellowfare:cabinet-ready',version:'1.0.31-v144',capabilities:['threads','proposals','messages','assemblies','agreements','milestones','evidence','settlement','repair','trust','recurrence','portable-bundles']},ORIGIN)},{once:true});

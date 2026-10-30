(()=>{
'use strict';
let catalog=null,core=null,initPromise=null;const selection=new Set();
const root=()=>document.getElementById('cs-world-grid');
function setNotice(message,bad=false){const n=document.getElementById('cs-world-status');if(n){n.textContent=message;n.className='cs-status'+(bad?' cs-bad':'');}}
function render(){
  const panel=root();if(!panel||!catalog)return;panel.replaceChildren();
  for(const world of catalog.worlds){
    const card=document.createElement('label');card.className='cs-world-card'+(selection.has(world.id)?' is-selected':'');
    const image=document.createElement('div');image.className='cs-world-image';image.setAttribute('aria-hidden','true');
    if(typeof world.artwork==='string'&&/^\\/creator-suite\\/story-protocols\\/artwork\\/[a-z0-9-]+\\.(?:webp|png|jpg)$/.test(world.artwork)){
      const img=document.createElement('img');img.src=world.artwork;img.alt='';img.loading='lazy';image.append(img);
    }else{
      const icon=document.createElement('span');icon.textContent=['◈','✦','✶','◇','☾','◎','⚔','❖','❀'][catalog.worlds.indexOf(world)%9];image.append(icon);
    }
    const info=document.createElement('span');info.className='cs-world-info';
    const heading=document.createElement('strong');heading.textContent=world.name;
    const genre=document.createElement('small');genre.textContent=world.genre;
    const premise=document.createElement('span');premise.textContent=world.premise;
    const input=document.createElement('input');input.type='checkbox';input.checked=selection.has(world.id);input.setAttribute('aria-label','Include '+world.name);
    input.addEventListener('change',()=>{
      if(input.checked&&selection.size>=3){input.checked=false;setNotice('Choose up to three worlds per crossover.',true);return;}
      if(input.checked)selection.add(world.id);else selection.delete(world.id);
      setNotice(selection.size?selection.size+' world'+(selection.size===1?'':'s')+' selected. Their public lore will guide each model call.':'Choose one world, or mix up to three.');render();
    });
    info.append(heading,genre,premise);card.append(input,image,info);panel.append(card);
  }
}
async function init(){
  if(!root())return;
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    const [response,library]=await Promise.all([
      fetch('/creator-suite/story-protocols/catalog-v1.json',{cache:'force-cache'}),
      import('/creator-suite/story-protocols/protocol-core-v1.mjs')
    ]);
    if(!response.ok)throw new Error('Story protocols unavailable offline. Open Creator Suite after installation.');
    const parsed=await response.json();
    if(parsed.schema!==library.PROTOCOL_SCHEMA||parsed.worlds.length!==9)throw new Error('Story protocol catalog failed verification.');
    catalog=parsed;core=library;render();setNotice('All nine world protocols are included. Choose up to three; no model download is required.');
  })().catch(error=>{initPromise=null;setNotice(error.message||String(error),true);throw error;});
  return initPromise;
}
function generationContext(){return catalog&&core?core.buildGenerationContext(catalog,[...selection]):'';}
globalThis.CivweaveStoryProtocolPickerV1=Object.freeze({init,getSelected:()=>[...selection],generationContext,ready:()=>initPromise||Promise.resolve()});
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>init().catch(console.warn)):init().catch(console.warn);
})();

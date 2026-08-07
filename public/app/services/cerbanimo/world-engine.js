/* Civweave World Engine: Cerbanimo adapter, RC19.5
 * Data-driven scenes with object actions, resident actors, ambient events, persistent state,
 * and a compatibility fallback to the legacy spatial hotspot renderer.
 */
(function(global){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  class CerbanimoWorldEngine extends EventTarget{
    constructor(options={}){
      super();this.root=options.root||null;this.storageKey=options.storageKey||'cerbanimo.world-engine.state.v1';
      this.onActivate=options.onActivate||(()=>{});this.onNavigate=options.onNavigate||(()=>{});this.onAnnounce=options.onAnnounce||(()=>{});
      this.scenes=new Map();this.sceneId=null;this.timer=null;this.toastTimer=null;this.state=this.load();
    }
    load(){try{return JSON.parse(localStorage.getItem(this.storageKey)||'{}')||{}}catch{return {}}}
    save(){try{localStorage.setItem(this.storageKey,JSON.stringify(this.state))}catch{};this.dispatchEvent(new CustomEvent('statechange',{detail:{state:this.state,sceneId:this.sceneId}}))}
    get(path,fallback=null){let c=this.state;for(const p of String(path||'').split('.').filter(Boolean)){if(c==null||!(p in c))return fallback;c=c[p]}return c}
    set(path,value){const ps=String(path||'').split('.').filter(Boolean);if(!ps.length)return;let c=this.state;for(const p of ps.slice(0,-1)){c[p]=c[p]&&typeof c[p]==='object'?c[p]:{};c=c[p]}c[ps.at(-1)]=value;this.save()}
    increment(path,n=1){const v=Number(this.get(path,0))+Number(n||0);this.set(path,v);return v}
    registerScene(scene){if(!scene?.id)throw new Error('Scene id required');this.scenes.set(scene.id,{objects:[],actors:[],ambient:[],...scene});return scene}
    registerScenes(scenes=[]){scenes.forEach(s=>this.registerScene(s));return this}
    scene(id=this.sceneId){return this.scenes.get(id)||null}
    mount(id,root=this.root){if(root)this.root=root;if(!this.root)throw new Error('Render root required');const scene=this.scene(id);if(!scene)throw new Error(`Unknown scene ${id}`);this.sceneId=id;this.render();this.startAmbient();this.onAnnounce(`Entered ${scene.label||id}.`);this.dispatchEvent(new CustomEvent('sceneenter',{detail:{scene}}));return scene}
    unmount(){this.stopAmbient();if(this.root)this.root.innerHTML='';this.sceneId=null}
    render(){const s=this.scene();if(!s||!this.root)return;const objects=s.objects.filter(o=>o.visible!==false);const actors=s.actors.filter(a=>a.visible!==false);
      this.root.innerHTML=`<section class="visual-scene active cw-world-scene" data-scene="${esc(s.id)}" aria-label="${esc(s.label)}"><div class="visual-scene-frame"><img src="${esc(s.image)}" alt="${esc(s.label)}" draggable="false"><div class="cw-world-ambient" aria-hidden="true"></div>${objects.map((o,i)=>this.renderObject(o,i)).join('')}${actors.map((a,i)=>this.renderActor(a,i)).join('')}<div class="cw-world-toast" data-world-toast role="status" aria-live="polite"></div></div></section>`;
      this.root.querySelectorAll('[data-world-object]').forEach(b=>b.addEventListener('click',()=>this.activateObject(objects[Number(b.dataset.worldObject)])));
      this.root.querySelectorAll('[data-world-actor]').forEach(b=>b.addEventListener('click',()=>this.activateActor(actors[Number(b.dataset.worldActor)])));
    }
    renderObject(o,i){const b=o.bounds||{};return `<button type="button" class="visual-hotspot cw-world-object ${esc(o.className||'')}" data-world-object="${i}" aria-label="${esc(o.label||'Interact')}" style="left:${clamp(b.x,0,100)}%;top:${clamp(b.y,0,100)}%;width:${clamp(b.w,1,100)}%;height:${clamp(b.h,1,100)}%"></button>`}
    renderActor(a,i){const p=a.position||{};return `<button type="button" class="cw-world-actor ${esc(a.className||'')}" data-world-actor="${i}" aria-label="Talk to ${esc(a.label||'resident')}" style="left:${clamp(p.x,0,100)}%;top:${clamp(p.y,0,100)}%"><span class="cw-world-actor-glyph" aria-hidden="true">${esc(a.glyph||'✦')}</span><span class="cw-world-actor-name">${esc(a.label||'Resident')}</span></button>`}
    activateObject(o){if(!o)return;this.increment(`${this.sceneId}.objects.${o.id||'object'}.uses`,1);this.dispatchEvent(new CustomEvent('objectactivate',{detail:{object:o,scene:this.scene()}}));this.onActivate(o.spot||o,{scene:this.scene(),engine:this})}
    activateActor(a){if(!a)return;const n=this.increment(`${this.sceneId}.actors.${a.id||'resident'}.visits`,1);const lines=a.lines||[];const line=lines.length?lines[(n-1)%lines.length]:`${a.label||'The resident'} acknowledges you.`;this.show(`${a.label}: ${line}`,5000);if(typeof a.run==='function')a.run(this.state,this,a);this.dispatchEvent(new CustomEvent('actoractivate',{detail:{actor:a,scene:this.scene()}}))}
    show(message,duration=2800){const n=this.root?.querySelector('[data-world-toast]');if(!n)return;n.textContent=message;n.classList.add('open');this.onAnnounce(message);clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>n.classList.remove('open'),duration)}
    startAmbient(){this.stopAmbient();const s=this.scene();if(!s?.ambient?.length)return;this.timer=setInterval(()=>{const e=s.ambient[Math.floor(Math.random()*s.ambient.length)];if(e?.message)this.show(typeof e.message==='function'?e.message(this.state,this):e.message,2600);if(e?.stateKey)this.increment(e.stateKey,e.amount||1);this.dispatchEvent(new CustomEvent('ambient',{detail:{event:e,scene:s}}))},Number(s.ambientInterval||48000))}
    stopAmbient(){if(this.timer){clearInterval(this.timer);this.timer=null}}
    listActions(id=this.sceneId){const s=this.scene(id);return s?[...s.objects,...s.actors.map(a=>({...a,__worldActor:true}))]:[]}
  }
  global.CerbanimoWorldEngine=CerbanimoWorldEngine;
})(window);

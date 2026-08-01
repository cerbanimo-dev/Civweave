/* Commonweave World Engine v0.1
 * Data-driven visual scenes, objects, portals, NPCs, ambient events, and saved room state.
 * No framework or network dependency. Designed for offline Commonweave services.
 */
(function(global){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  function fitVisualFrame(root,frame){
    if(!root||!frame)return;
    const image=frame.querySelector('img');
    const apply=()=>{
      const sourceWidth=Number(frame.dataset.sourceWidth)||image?.naturalWidth||768;
      const sourceHeight=Number(frame.dataset.sourceHeight)||image?.naturalHeight||1792;
      const bounds=root.getBoundingClientRect();
      if(!bounds.width||!bounds.height||!sourceWidth||!sourceHeight)return;
      const scale=Math.min(bounds.width/sourceWidth,bounds.height/sourceHeight);
      frame.style.setProperty('--cw-fit-width',`${Math.max(1,Math.round(sourceWidth*scale))}px`);
      frame.style.setProperty('--cw-fit-height',`${Math.max(1,Math.round(sourceHeight*scale))}px`);
    };
    if(image&&!image.complete)image.addEventListener('load',apply,{once:true});
    apply();
    return apply;
  }

  class CommonweaveWorldEngine extends EventTarget {
    constructor(options={}){
      super();
      this.root=options.root||null;
      this.storageKey=options.storageKey||'commonweave.world-state.v1';
      this.handlers={
        navigate:options.onNavigate||(()=>{}),
        workspace:options.onWorkspace||(()=>{}),
        action:options.onAction||(()=>{}),
        announce:options.onAnnounce||(()=>{})
      };
      this.scenes=new Map();
      this.sceneId=null;
      this.state=this.loadState();
      this.ambientTimer=null;
      this.fitHandler=()=>{const frame=this.root?.querySelector('.ls-visual-frame');if(frame)fitVisualFrame(this.root,frame);};
      global.addEventListener('resize',this.fitHandler,{passive:true});
      global.addEventListener('orientationchange',this.fitHandler,{passive:true});
    }

    loadState(){
      try{return JSON.parse(localStorage.getItem(this.storageKey)||'{}')||{};}catch{return {};}
    }
    saveState(){
      try{localStorage.setItem(this.storageKey,JSON.stringify(this.state));}catch{}
      this.dispatchEvent(new CustomEvent('statechange',{detail:{state:this.state,sceneId:this.sceneId}}));
    }
    get(path,fallback=null){
      const parts=String(path||'').split('.').filter(Boolean);let cursor=this.state;
      for(const part of parts){if(cursor==null||!(part in cursor))return fallback;cursor=cursor[part];}
      return cursor;
    }
    set(path,value){
      const parts=String(path||'').split('.').filter(Boolean);if(!parts.length)return;
      let cursor=this.state;for(const part of parts.slice(0,-1)){cursor[part]=cursor[part]&&typeof cursor[part]==='object'?cursor[part]:{};cursor=cursor[part];}
      cursor[parts.at(-1)]=value;this.saveState();
    }
    increment(path,amount=1){const next=Number(this.get(path,0))+Number(amount||0);this.set(path,next);return next;}
    toggle(path){const next=!Boolean(this.get(path,false));this.set(path,next);return next;}

    registerScene(scene){
      if(!scene?.id)throw new Error('A world scene requires an id.');
      const normalized={objects:[],actors:[],ambient:[],...scene};
      this.scenes.set(scene.id,normalized);return normalized;
    }
    registerScenes(scenes=[]){scenes.forEach(scene=>this.registerScene(scene));return this;}
    getScene(id=this.sceneId){return this.scenes.get(id)||null;}

    mount(sceneId,root=this.root){
      if(root)this.root=root;
      if(!this.root)throw new Error('World Engine requires a render root.');
      const scene=this.getScene(sceneId);if(!scene)throw new Error(`Unknown world scene: ${sceneId}`);
      this.sceneId=sceneId;this.render();this.startAmbient();
      this.handlers.announce(`Entered ${scene.label||scene.id}.`);
      this.dispatchEvent(new CustomEvent('sceneenter',{detail:{scene}}));
      return scene;
    }
    unmount(){this.stopAmbient();if(this.root)this.root.innerHTML='';this.sceneId=null;}

    visible(item){
      if(typeof item.visible==='function')return Boolean(item.visible(this.state,this));
      if(item.requires)return Boolean(this.get(item.requires,false));
      return item.visible!==false;
    }
    objectLabel(item){return typeof item.label==='function'?item.label(this.state,this):item.label;}

    render(){
      const scene=this.getScene();if(!scene||!this.root)return;
      const objects=scene.objects.filter(item=>this.visible(item));
      const actors=scene.actors.filter(item=>this.visible(item));
      const image=typeof scene.image==='function'?scene.image(this.state,this):scene.image;
      const mood=this.get(`${scene.id}.mood`,'busy');
      this.root.innerHTML=`
        <div class="ls-visual-frame cw-world-scene" data-world-scene="${esc(scene.id)}" data-world-mood="${esc(mood)}" data-source-width="${esc(scene.width||'')}" data-source-height="${esc(scene.height||'')}">
          <img src="${esc(image)}" alt="${esc(scene.alt||`${scene.label} illustrated visual room`)}" draggable="false">
          <div class="cw-world-ambient" aria-hidden="true"></div>
          ${objects.map((item,index)=>this.renderObject(item,index)).join('')}
          ${actors.map((actor,index)=>this.renderActor(actor,index)).join('')}
          <div class="cw-world-toast" data-world-toast role="status" aria-live="polite"></div>
        </div>`;
      this.root.querySelectorAll('[data-world-object]').forEach(button=>button.addEventListener('click',()=>this.activateObject(objects[Number(button.dataset.worldObject)])));
      this.root.querySelectorAll('[data-world-actor]').forEach(button=>button.addEventListener('click',()=>this.activateActor(actors[Number(button.dataset.worldActor)])));
      fitVisualFrame(this.root,this.root.querySelector('.ls-visual-frame'));
      if(typeof scene.onRender==='function')scene.onRender(this.root,this.state,this);
    }
    renderObject(item,index){
      const b=item.bounds||{};const label=this.objectLabel(item)||'Interact';
      const style=`left:${clamp(b.x,0,100)}%;top:${clamp(b.y,0,100)}%;width:${clamp(b.w,1,100)}%;height:${clamp(b.h,1,100)}%`;
      const classes=['ls-hotspot','cw-world-object',item.className||'',this.get(`${this.sceneId}.objects.${item.id}.active`,false)?'is-active':''].filter(Boolean).join(' ');
      return `<button type="button" class="${classes}" data-world-object="${index}" data-world-id="${esc(item.id||index)}" aria-label="${esc(label)}" style="${style}"><span>${esc(label)}</span></button>`;
    }
    renderActor(actor,index){
      const p=actor.position||{};const label=this.objectLabel(actor)||'Character';
      return `<button type="button" class="cw-world-actor ${esc(actor.className||'')}" data-world-actor="${index}" style="left:${clamp(p.x,0,100)}%;top:${clamp(p.y,0,100)}%" aria-label="Talk to ${esc(label)}"><span class="cw-world-actor-glyph" aria-hidden="true">${esc(actor.glyph||'✦')}</span><span class="cw-world-actor-name">${esc(label)}</span></button>`;
    }

    activateObject(item){
      if(!item)return;
      const detail={item,scene:this.getScene(),engine:this};
      this.dispatchEvent(new CustomEvent('objectactivate',{detail}));
      if(item.portal){this.handlers.navigate(item.portal,detail);return;}
      if(item.workspace){this.handlers.workspace({workspace:item.workspace,focus:item.focus,label:this.objectLabel(item)},detail);return;}
      if(item.action==='toggle'&&item.stateKey){const active=this.toggle(item.stateKey);this.showMessage(item.messages?.[active?'on':'off']||`${this.objectLabel(item)} ${active?'on':'off'}.`);this.render();return;}
      if(item.action==='increment'&&item.stateKey){const value=this.increment(item.stateKey,item.amount||1);this.showMessage(typeof item.message==='function'?item.message(value):item.message||`${this.objectLabel(item)}: ${value}`);this.render();return;}
      if(item.action==='message'){this.showMessage(typeof item.message==='function'?item.message(this.state,this,item):item.message||this.objectLabel(item));return;}
      if(typeof item.run==='function'){item.run(this.state,this,item);return;}
      this.handlers.action(item,detail);
    }
    activateActor(actor){
      if(!actor)return;
      const visits=this.increment(`${this.sceneId}.actors.${actor.id||'actor'}.visits`,1);
      const lines=typeof actor.lines==='function'?actor.lines(this.state,this):actor.lines||[];
      const line=lines.length?lines[(visits-1)%lines.length]:`${this.objectLabel(actor)} nods hello.`;
      this.showMessage(`${this.objectLabel(actor)}: ${line}`,5200);
      if(typeof actor.run==='function')actor.run(this.state,this,actor);
      this.dispatchEvent(new CustomEvent('actoractivate',{detail:{actor,scene:this.getScene(),engine:this}}));
    }
    showMessage(message,duration=3200){
      const node=this.root?.querySelector('[data-world-toast]');if(!node)return;
      node.textContent=message;node.classList.add('open');this.handlers.announce(message);
      clearTimeout(this.messageTimer);this.messageTimer=setTimeout(()=>node.classList.remove('open'),duration);
    }

    startAmbient(){
      this.stopAmbient();const scene=this.getScene();if(!scene?.ambient?.length)return;
      const pulse=()=>{
        const choices=scene.ambient.filter(event=>this.visible(event));if(!choices.length)return;
        const event=choices[Math.floor(Math.random()*choices.length)];
        if(event.stateKey&&event.action==='increment')this.increment(event.stateKey,event.amount||1);
        if(event.message)this.showMessage(typeof event.message==='function'?event.message(this.state,this):event.message,2600);
        this.dispatchEvent(new CustomEvent('ambient',{detail:{event,scene}}));
      };
      this.ambientTimer=setInterval(pulse,Number(scene.ambientInterval||45000));
    }
    stopAmbient(){if(this.ambientTimer){clearInterval(this.ambientTimer);this.ambientTimer=null;}}

    listActions(sceneId=this.sceneId){
      const scene=this.getScene(sceneId);if(!scene)return [];
      return [...scene.objects.filter(item=>this.visible(item)),...scene.actors.filter(item=>this.visible(item)).map(actor=>({...actor,action:'actor',__worldActor:true}))];
    }
  }

  global.CommonweaveFitVisualFrame=fitVisualFrame;
  global.CommonweaveWorldEngine=CommonweaveWorldEngine;
})(window);

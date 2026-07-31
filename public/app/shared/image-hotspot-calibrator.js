(()=>{
  'use strict';
  const bindings=new WeakMap();
  const rules=[
    ['.cw-scene','.cw-scene-bg','.cw-hotspot,.cw-feature-hotspot'],
    ['.mall-scene','.mall-scene-background','.mall-feature-hotspot'],
    ['.ls-visual-frame','img','.ls-hotspot'],
    ['.visual-scene-frame','img','.visual-hotspot'],
    ['.visual-stage-canvas','picture img,.visual-stage-canvas>img','.scene-hotspot']
  ];
  function positionFraction(value,axis){
    const source=String(value||'50% 50%').trim().toLowerCase().split(/\s+/);
    let token=axis===0?source[0]:(source[1]||source[0]);
    if(axis===0&&['top','bottom'].includes(token))token='50%';
    if(axis===1&&['left','right'].includes(token))token='50%';
    if(token==='left'||token==='top')return 0;
    if(token==='right'||token==='bottom')return 1;
    if(token==='center')return .5;
    const n=parseFloat(token);
    return Number.isFinite(n)?Math.max(0,Math.min(1,n/100)):.5;
  }
  function remember(button){
    if(button.dataset.imageX)return true;
    const values=['left','top','width','height'].map(key=>button.style[key]);
    if(values.some(value=>!/%$/.test(value||'')))return false;
    [button.dataset.imageX,button.dataset.imageY,button.dataset.imageW,button.dataset.imageH]=values.map(parseFloat);
    return true;
  }
  function calibrate(container,image,selector){
    if(!container?.isConnected||!image?.naturalWidth||!image?.naturalHeight)return;
    const rect=container.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return;
    const style=getComputedStyle(image);
    const fit=style.objectFit||'fill';
    const iw=image.naturalWidth,ih=image.naturalHeight,cw=rect.width,ch=rect.height;
    let rw=cw,rh=ch;
    if(fit==='cover'||fit==='contain'){
      const scale=fit==='cover'?Math.max(cw/iw,ch/ih):Math.min(cw/iw,ch/ih);
      rw=iw*scale;rh=ih*scale;
    }else if(fit==='none'){rw=iw;rh=ih}
    const px=positionFraction(style.objectPosition,0),py=positionFraction(style.objectPosition,1);
    const ox=(cw-rw)*px,oy=(ch-rh)*py;
    container.querySelectorAll(selector).forEach(button=>{
      if(!remember(button))return;
      const x=Number(button.dataset.imageX),y=Number(button.dataset.imageY),w=Number(button.dataset.imageW),h=Number(button.dataset.imageH);
      button.style.left=`${ox+(x/100)*rw}px`;
      button.style.top=`${oy+(y/100)*rh}px`;
      button.style.width=`${(w/100)*rw}px`;
      button.style.height=`${(h/100)*rh}px`;
    });
  }
  function bind(container,image,selector){
    if(!container||!image)return;
    const prior=bindings.get(container);
    if(prior?.image===image&&prior.selector===selector){calibrate(container,image,selector);return}
    prior?.observer?.disconnect?.();
    const run=()=>requestAnimationFrame(()=>calibrate(container,image,selector));
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(run):null;
    observer?.observe(container);observer?.observe(image);
    image.addEventListener('load',run,{once:false});
    bindings.set(container,{image,selector,observer});
    run();
  }
  function scan(scope=document){
    for(const [containerSelector,imageSelector,hotspotSelector] of rules){
      scope.querySelectorAll?.(containerSelector).forEach(container=>{
        const image=container.querySelector(imageSelector);
        if(image)bind(container,image,hotspotSelector);
      });
    }
  }
  const schedule=(()=>{let queued=false;return()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan(document)})}})();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('orientationchange',schedule,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.CommonweaveImageHotspots={scan,calibrate};
})();

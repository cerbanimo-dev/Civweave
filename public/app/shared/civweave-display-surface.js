(()=>{"use strict";
const PROFILES=Object.freeze({
 "chalkboard-kiosk":"chalkboard-full","chalkboard-weekly":"chalkboard-narrow","chalkboard-easel":"easel",
 "hologram-wall":"hologram-wall","hologram-pedestal":"hologram-portrait","hologram-topic-map":"orb",
 "hologram-constellation":"observatory-arch","hologram-cluster":"multi-dashboard"
});
function infer(el){const explicit=el.dataset.cwSurface||el.closest?.('[data-surface]')?.dataset.surface||"";return PROFILES[explicit]||explicit||"hologram-wall"}
function mount(root,options={}){if(!root||root.dataset.cwSurfaceMounted)return null;const type=options.type||infer(root);root.classList.add("cw-display-surface");root.dataset.cwSurface=type;root.dataset.cwSurfaceMounted="1";const children=[...root.childNodes];const viewport=document.createElement("div");viewport.className="cw-display-surface__viewport";viewport.setAttribute("data-cw-surface-viewport","");children.forEach(n=>viewport.append(n));root.append(viewport);if(options.density)root.dataset.cwDensity=options.density;return {root,viewport,type,destroy(){viewport.replaceWith(...viewport.childNodes);delete root.dataset.cwSurfaceMounted;root.classList.remove("cw-display-surface")}}}
function scan(scope=document){scope.querySelectorAll?.("[data-cw-display-surface]").forEach(el=>mount(el,{type:el.dataset.cwDisplaySurface,density:el.dataset.cwDensity}))}
const api=Object.freeze({profiles:PROFILES,mount,scan,infer});window.CivweaveDisplaySurface=api;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scan(),{once:true});else scan();
})();

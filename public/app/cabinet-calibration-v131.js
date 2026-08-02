(()=>{
"use strict";
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const previousApplyShell=applyShell;
applyShell=function calibratedApplyShell(system){
  previousApplyShell(system);
  const screen=system.interfaceShell?.screen||{};
  document.documentElement.style.setProperty("--screen-clip",screen.clip||`inset(0 round ${number(screen.radius,4.2)}%)`);
  document.documentElement.style.setProperty("--screen-content-top",`${number(screen.contentTop,0)}%`);
};
const previousRenderCabinetControls=renderCabinetControls;
renderCabinetControls=function calibratedCabinetControls(system){
  const shell=system.interfaceShell||{};
  const order=shell.controlOrder||["anarchadia","fellowfare","commonweave","living-school","cerbanimo"];
  if(!Array.isArray(shell.controls)||shell.controls.length!==order.length){
    previousRenderCabinetControls(system);
    return;
  }
  const target=document.querySelector("#cabinet-controls");
  target.innerHTML=shell.controls.map((control,index)=>{
    const id=control.system||order[index];
    const item=systemFor(id);
    const x=number(control.x,50);
    const y=number(control.y,91);
    const size=number(control.size,9);
    return `<button type="button" class="${id===system.id?"is-active":""}" data-system="${esc(id)}" aria-label="Open ${esc(item.name)}" style="--control-x:${x}%;--control-y:${y}%;--control-size:${size}%"></button>`;
  }).join("");
};
})();
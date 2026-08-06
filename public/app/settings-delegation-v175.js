(()=>{
'use strict';
const VERSION='188.0-ai-settings-cleanroom-delegation';
if(globalThis.CivweaveSettingsDelegationV188?.version===VERSION)return;
const SELECTOR='[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
function controller(){return globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveUnifiedAISettingsV175||null;}
function open(launcher){return controller()?.open?.(launcher)||null;}
function onClick(event){
  const launcher=event.target instanceof Element?event.target.closest(SELECTOR):null;
  if(!launcher)return;
  event.preventDefault();
  event.stopPropagation();
  open(launcher);
}
document.addEventListener('click',onClick);
const inertLog=Object.freeze({
  version:'retired-by-ai-settings-cleanroom-v188',
  setLevel(){return'off';},
  getLevel(){return'off';},
  enabled(){return false;},
  write(){return null;},
  error(){return null;},
  warn(){return null;},
  info(){return null;},
  debug(){return null;},
  trace(){return null;},
  snapshot(){return[];},
  exportText(){return'';},
  copy(){return Promise.resolve(false);},
  download(){return false;},
  clear(){return true;},
  renderDock(){return null;},
});
globalThis.CivweaveLogV183=inertLog;
globalThis.CivweaveSettingsDelegationV188=Object.freeze({
  version:VERSION,
  selector:SELECTOR,
  listenerPhase:'bubble',
  listenerCount:1,
  mutationObserver:false,
  polling:false,
  timers:false,
  diagnosticsRuntime:false,
  providerRuntimeOnOpen:false,
  open,
});
document.documentElement.dataset.settingsDelegation='cleanroom-v188';
})();

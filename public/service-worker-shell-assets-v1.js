;(()=>{
'use strict';
const REVISION='shell-assets-v1-repair-v2';
const OPTIONAL=['/app/installer-repair-only-v2.js'];
for(const pathname of OPTIONAL){
  if(!OPTIONAL_SHELL_ASSETS.includes(pathname))OPTIONAL_SHELL_ASSETS.push(pathname);
  if(!SHELL_ASSETS.includes(pathname))SHELL_ASSETS.push(pathname);
}
self.CivweaveShellAssetsV1=Object.freeze({revision:REVISION,optional:[...OPTIONAL],policy:'declarative-shell-assets-only-no-repair-or-message-ownership'});
})();

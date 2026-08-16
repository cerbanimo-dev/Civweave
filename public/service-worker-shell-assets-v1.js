;(()=>{
'use strict';
const REVISION='shell-assets-v1-repair-v3-family-navigation';
const OPTIONAL=[
  '/app/installer-repair-only-v2.js',
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/subsystem-avatar-state-v347.js',
  '/Civweave-weaveling-sprites.png',
  '/Living-School-moss-sprites.png',
  '/Cerbanimo-kamiya-sprites.png',
  '/FellowFare-rook-sprites.png',
  '/Anarchadia-merlin-sprites.png',
  '/app/assets/ai/chat/weaveling-face-v255.webp',
  '/app/assets/ai/chat/moss-face-v255.webp',
  '/app/assets/ai/chat/kamiya-face-v255.webp',
  '/app/assets/ai/chat/rook-face-v255.webp',
  '/app/assets/ai/chat/merlin-face-v255.webp'
];
for(const pathname of OPTIONAL){
  if(!OPTIONAL_SHELL_ASSETS.includes(pathname))OPTIONAL_SHELL_ASSETS.push(pathname);
  if(!SHELL_ASSETS.includes(pathname))SHELL_ASSETS.push(pathname);
}
self.CivweaveShellAssetsV1=Object.freeze({revision:REVISION,optional:[...OPTIONAL],policy:'declarative-shell-assets-only-no-repair-or-message-ownership'});
})();

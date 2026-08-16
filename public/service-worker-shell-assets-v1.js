;(()=>{
'use strict';
const REVISION='shell-assets-v1-repair-v6-working-campus-guild-quest';
const OPTIONAL=['/app/installer-repair-only-v2.js'];
const REQUIRED_FAMILY_NAV=[
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js'
];
const OPTIONAL_FAMILY_NAV=[
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
const REQUIRED_GUILD_QUEST=[
  '/app/civweave-guild-quest-embed-v1.html',
  '/app/cerbanimo-intention-landscape-v1.css',
  '/app/cerbanimo-intention-landscape-v1.js'
];
const OPTIONAL_GUILD_QUEST=[
  '/app/civweave-guild-quest-v1.html'
];
for(const pathname of [...REQUIRED_FAMILY_NAV,...REQUIRED_GUILD_QUEST]){
  const optionalIndex=OPTIONAL_SHELL_ASSETS.indexOf(pathname);
  if(optionalIndex>=0)OPTIONAL_SHELL_ASSETS.splice(optionalIndex,1);
  if(!REQUIRED_SHELL_ASSETS.includes(pathname))REQUIRED_SHELL_ASSETS.push(pathname);
  if(!SHELL_ASSETS.includes(pathname))SHELL_ASSETS.push(pathname);
}
for(const pathname of [...OPTIONAL,...OPTIONAL_FAMILY_NAV,...OPTIONAL_GUILD_QUEST]){
  if(!OPTIONAL_SHELL_ASSETS.includes(pathname))OPTIONAL_SHELL_ASSETS.push(pathname);
  if(!SHELL_ASSETS.includes(pathname))SHELL_ASSETS.push(pathname);
}
self.CivweaveShellAssetsV1=Object.freeze({
  revision:REVISION,
  requiredFamilyNavigation:[...REQUIRED_FAMILY_NAV],
  requiredGuildQuest:[...REQUIRED_GUILD_QUEST],
  optional:[...OPTIONAL,...OPTIONAL_FAMILY_NAV,...OPTIONAL_GUILD_QUEST],
  policy:'declarative-shell-assets-only-no-repair-or-message-ownership'
});
})();
;(()=>{
'use strict';
const REVISION='shell-assets-v1-repair-v26-persistent-human-chat-required';
const OPTIONAL=['/app/installer-repair-only-v2.js'];
const REQUIRED_FAMILY_NAV=[
  '/app/persistent-system-shell-v1.html',
  '/app/persistent-system-shell-v1.js',
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/subsystem-avatar-state-v347.js'
];
const REQUIRED_NAV_MEDIA=[
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
const REQUIRED_CIVWEAVE_BOOT=[
  '/app/pwa-start-v436.html',
  '/app/working-campus-return-guard-v425.js',
  '/app/document-lifecycle-v221.js',
  '/app/working-campus-home-declutter-v1.js',
  '/app/working-campus-home-relocation-v441.js',
  '/app/shared-tools-cleanup-v175.js',
  '/app/local-ai/browser-pack-download-v1.js',
  '/app/local-ai/browser-pack-pwa-import-v1.js'
];
const REQUIRED_HUMAN_CHAT=[
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js',
  '/app/human-chat-standalone-v2.js'
];
const OPTIONAL_GUILD_QUEST=[
  '/app/civweave-guild-quest-v1.html',
  '/app/civweave-guild-quest-embed-v1.html',
  '/app/cerbanimo-intention-landscape-v1.css',
  '/app/cerbanimo-intention-landscape-v1.js'
];
const OPTIONAL_HUMAN_CHAT=[
  '/app/guild-membership-mesh-v1.js',
  '/app/ble-object-transport-v1.js',
  '/app/human-chat-ble-controls-v1.js',
  '/app/civweave-private-messaging-v1.js',
  '/app/local-object-mesh-v146.js',
  '/app/shared-intention-party-chat-v1.js'
];
for(const pathname of [...REQUIRED_FAMILY_NAV,...REQUIRED_NAV_MEDIA,...REQUIRED_CIVWEAVE_BOOT,...REQUIRED_HUMAN_CHAT]){
  const optionalIndex=OPTIONAL_SHELL_ASSETS.indexOf(pathname);
  if(optionalIndex>=0)OPTIONAL_SHELL_ASSETS.splice(optionalIndex,1);
  if(!REQUIRED_SHELL_ASSETS.includes(pathname))REQUIRED_SHELL_ASSETS.push(pathname);
  if(!SHELL_ASSETS.includes(pathname))SHELL_ASSETS.push(pathname);
}
for(const pathname of [...OPTIONAL,...OPTIONAL_GUILD_QUEST,...OPTIONAL_HUMAN_CHAT]){
  const requiredIndex=REQUIRED_SHELL_ASSETS.indexOf(pathname);
  if(requiredIndex>=0)REQUIRED_SHELL_ASSETS.splice(requiredIndex,1);
  if(!OPTIONAL_SHELL_ASSETS.includes(pathname))OPTIONAL_SHELL_ASSETS.push(pathname);
  if(!SHELL_ASSETS.includes(pathname))SHELL_ASSETS.push(pathname);
}
self.CivweaveShellAssetsV1=Object.freeze({
  revision:REVISION,
  requiredFamilyNavigation:[...REQUIRED_FAMILY_NAV],
  requiredNavigationMedia:[...REQUIRED_NAV_MEDIA],
  requiredCivweaveBoot:[...REQUIRED_CIVWEAVE_BOOT],
  requiredHumanChat:[...REQUIRED_HUMAN_CHAT],
  optional:[...OPTIONAL,...OPTIONAL_GUILD_QUEST,...OPTIONAL_HUMAN_CHAT],
  humanChat:[...REQUIRED_HUMAN_CHAT,...OPTIONAL_HUMAN_CHAT],
  humanChatRoster:'signed-local-object-v1',
  humanChatBle:'object-transport-v1',
  pwaStart:'/app/pwa-start-v436.html',
  persistentSystemShell:'/app/persistent-system-shell-v1.html',
  policy:'one-persistent-top-level-navbar-shell-with-required-sprite-media-and-required-human-chat-launcher-runtime'
});
})();
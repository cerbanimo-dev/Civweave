import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/app/shared-chat-face-icons-v255.js',import.meta.url),'utf8');
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};

check('launcher owns fixed viewport positioning',source.includes('#${LAUNCHER_ID}{position:fixed!important'));
check('launcher is circular instead of a square image button',source.includes('border-radius:50%!important')&&source.includes("launcherShape:'circle'"));
check('launcher is screen-sized rather than natural-image-sized',source.includes('width:52px!important;height:52px!important')&&source.includes('width:48px!important;height:48px!important'));
check('launcher stays above the themed system dock',source.includes('bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px)!important'));
check('mobile launcher respects safe areas',source.includes('right:max(10px,env(safe-area-inset-right))!important')&&source.includes('env(safe-area-inset-bottom)'));
check('launcher image is forced to fill the circle',source.includes('#${LAUNCHER_ID} img{display:block!important;width:100%!important;height:100%!important')&&source.includes('border-radius:50%!important;object-fit:cover!important'));
check('launcher has explicit top-layer touch ownership',source.includes('z-index:2147483643!important')&&source.includes('pointer-events:auto!important')&&source.includes('touch-action:manipulation!important'));
check('runtime advertises launcher geometry contract',source.includes("launcherPosition:'fixed'")&&source.includes('launcherDesktopPx:52')&&source.includes('launcherMobilePx:48'));

console.log(JSON.stringify({ok:true,revision:'mobile-chat-bubble-anchor-v342',checks:checks.length,launcher:{position:'fixed',shape:'circle',desktopPx:52,mobilePx:48,narrowPx:46}},null,2));

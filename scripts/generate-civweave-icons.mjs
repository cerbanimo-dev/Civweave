import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const logoDir=path.join(root,'public','app','logos');
const sourcePath=path.join(logoDir,'civweave-day-logo.jpg');
const soft=process.argv.includes('--soft');
const ICON_SIZES=[16,32,48,72,96,128,144,152,180,192,384,512,1024];

async function render(size){
  return sharp(sourcePath)
    .resize(size,size,{fit:'contain',kernel:'lanczos3',withoutEnlargement:false})
    .png({compressionLevel:9,adaptiveFiltering:true})
    .toBuffer();
}
async function writeIcon(file,buffer){await fsp.writeFile(path.join(logoDir,file),buffer)}

async function main(){
  const rendered=new Map();
  for(const size of ICON_SIZES){
    const buffer=await render(size);
    rendered.set(size,buffer);
    await writeIcon(`civweave-icon-${size}.png`,buffer);
  }
  await writeIcon('civweave-app-icon.png',rendered.get(1024));
  for(const size of [192,512])await writeIcon(`civweave-icon-maskable-${size}.png`,rendered.get(size));
  await writeIcon('civweave-adaptive-foreground-512.png',rendered.get(512));

  // Compatibility tombstones only. No live source may point at these names,
  // but old installed workers can still request them during upgrade. They now
  // return the current daytime artwork, never the retired heart logo.
  await writeIcon('civweave-pwa-192-v247.png',rendered.get(192));
  await writeIcon('civweave-pwa-512-v247.png',rendered.get(512));
  await writeIcon('civweave-pwa-maskable-512-v247.png',rendered.get(512));

  const summary={
    schema:'civweave.icon-generation.v3',
    source:'civweave-day-logo.jpg',
    launcherPolicy:'daytime-artwork-always',
    treatment:'approved-daytime-artwork-resize-only',
    targetFill:'100% source canvas; no crop, no substitute mark',
    generatedAt:new Date().toISOString(),
    files:[
      ...ICON_SIZES.map(size=>`civweave-icon-${size}.png`),
      'civweave-app-icon.png',
      'civweave-icon-maskable-192.png',
      'civweave-icon-maskable-512.png',
      'civweave-adaptive-foreground-512.png'
    ],
    compatibilityAliases:[
      'civweave-pwa-192-v247.png',
      'civweave-pwa-512-v247.png',
      'civweave-pwa-maskable-512-v247.png'
    ]
  };
  await fsp.writeFile(path.join(logoDir,'civweave-icon-generation.json'),JSON.stringify(summary,null,2));
  console.log(`[Civweave] Generated ${summary.files.length} launcher assets from the approved daytime logo; retired PWA aliases were overwritten with the same current pixels.`);
}

main().catch(error=>{
  if(soft){console.warn(`[Civweave] Icon generation skipped: ${error.message}`);return}
  console.error(error);
  process.exitCode=1;
});

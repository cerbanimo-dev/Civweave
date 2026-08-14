import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const logoDir=path.join(root,'public','app','logos');
const sourcePath=path.join(root,'Civweave-on-logo.png');
const soft=process.argv.includes('--soft');
const ICON_SIZES=[16,32,48,72,96,128,144,152,180,192,384,512,1024];
const DAYTIME_LAUNCHER_ICONS=[
  ['civweave-daytime-180-v1.png',180],
  ['civweave-daytime-192-v1.png',192],
  ['civweave-daytime-512-v1.png',512],
  ['civweave-daytime-maskable-192-v1.png',192],
  ['civweave-daytime-maskable-512-v1.png',512]
];

async function render(size){
  return sharp(sourcePath)
    .resize(size,size,{fit:'contain',kernel:'lanczos3',withoutEnlargement:false})
    .png({compressionLevel:9,adaptiveFiltering:true})
    .toBuffer();
}
async function writeIcon(file,buffer){await fsp.writeFile(path.join(logoDir,file),buffer)}

async function main(){
  for(const size of ICON_SIZES)await writeIcon(`civweave-icon-${size}.png`,await render(size));
  await writeIcon('civweave-app-icon.png',await render(1024));
  for(const size of [192,512])await writeIcon(`civweave-icon-maskable-${size}.png`,await render(size));
  await writeIcon('civweave-adaptive-foreground-512.png',await render(512));
  for(const [file,size] of DAYTIME_LAUNCHER_ICONS)await writeIcon(file,await render(size));
  const summary={
    schema:'civweave.icon-generation.v3',
    source:'Civweave-on-logo.png',
    sourceRole:'daytime-app-logo',
    treatment:'approved-daytime-artwork-resize-only',
    targetFill:'100% source canvas; no crop, no dark tile, no substitute mark',
    generatedAt:new Date().toISOString(),
    files:[
      ...ICON_SIZES.map(size=>`civweave-icon-${size}.png`),
      'civweave-app-icon.png',
      'civweave-icon-maskable-192.png',
      'civweave-icon-maskable-512.png',
      'civweave-adaptive-foreground-512.png',
      ...DAYTIME_LAUNCHER_ICONS.map(([file])=>file)
    ]
  };
  await fsp.writeFile(path.join(logoDir,'civweave-icon-generation.json'),JSON.stringify(summary,null,2));
  console.log(`[Civweave] Generated ${summary.files.length} app icon assets from the approved daytime logo.`);
}

try{
  await main();
}catch(error){
  if(soft){console.warn(`[Civweave] Icon generation skipped: ${error.message}`)}
  else{
    console.error(error);
    process.exitCode=1;
    throw error;
  }
}

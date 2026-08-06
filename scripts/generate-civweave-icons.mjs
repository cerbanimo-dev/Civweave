import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const logoDir=path.join(root,'public','app','logos');
const sourcePath=path.join(logoDir,'civweave.webp');
const soft=process.argv.includes('--soft');

const ICON_SIZES=[16,32,48,72,96,128,144,152,180,192,384,512,1024];

function clamp(value,min,max){
  return Math.min(max,Math.max(min,value));
}

async function buildSymbol(){
  const extracted=await sharp(sourcePath)
    .extract({left:130,top:0,width:994,height:950})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject:true});
  const {data,info}=extracted;
  const rgba=Buffer.alloc(info.width*info.height*4);
  let minX=info.width,minY=info.height,maxX=-1,maxY=-1;
  for(let y=0;y<info.height;y+=1){
    for(let x=0;x<info.width;x+=1){
      const src=(y*info.width+x)*3;
      const dst=(y*info.width+x)*4;
      const r=data[src],g=data[src+1],b=data[src+2];
      const distance=Math.sqrt((r-132)**2+(g-132)**2+(b-132)**2);
      const alpha=Math.round(clamp((distance-9)/18,0,1)*255);
      rgba[dst]=r;
      rgba[dst+1]=g;
      rgba[dst+2]=b;
      rgba[dst+3]=alpha;
      if(alpha>12){
        minX=Math.min(minX,x); minY=Math.min(minY,y);
        maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      }
    }
  }
  if(maxX<minX||maxY<minY)throw new Error('Civweave mark could not be separated from its source background.');
  return sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}})
    .extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1})
    .sharpen({sigma:.45,m1:.45,m2:1.1})
    .png()
    .toBuffer();
}

function backgroundSvg(size){
  const radius=Math.round(size*.14);
  const stroke=Math.max(1,Math.round(size/512));
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="48%" r="74%">
        <stop offset="0" stop-color="#152126"/>
        <stop offset=".56" stop-color="#0b1215"/>
        <stop offset="1" stop-color="#040709"/>
      </radialGradient>
      <filter id="grain" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="17"/>
        <feColorMatrix values="1 0 0 0 0
                               0 1 0 0 0
                               0 0 1 0 0
                               0 0 0 .035 0"/>
      </filter>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <rect width="${size}" height="${size}" filter="url(#grain)" opacity=".24"/>
    <rect x="${stroke*8}" y="${stroke*8}" width="${size-stroke*16}" height="${size-stroke*16}" rx="${radius}" fill="none" stroke="#6a9299" stroke-opacity=".16" stroke-width="${stroke}"/>
  </svg>`);
}

async function renderIcon(symbol,size,ratio,{background=true}={}){
  const width=Math.max(1,Math.round(size*ratio));
  const resized=await sharp(symbol).resize({width,fit:'inside',kernel:'lanczos3'}).png().toBuffer();
  const metadata=await sharp(resized).metadata();
  const left=Math.round((size-(metadata.width||width))/2);
  const top=Math.round((size-(metadata.height||width))/2);
  const composites=[];
  if(background){
    const shadow=await sharp(resized).tint('#000000').blur(Math.max(.3,size/90)).png().toBuffer();
    const halo=await sharp(resized).tint('#69d6e3').blur(Math.max(.3,size/55)).modulate({brightness:.7,saturation:.7}).png().toBuffer();
    composites.push({input:shadow,left:left+Math.max(1,Math.round(size/120)),top:top+Math.max(1,Math.round(size/95)),blend:'over',opacity:.52});
    composites.push({input:halo,left,top,blend:'screen',opacity:.18});
  }
  composites.push({input:resized,left,top,blend:'over'});
  const base=background
    ?sharp(backgroundSvg(size)).resize(size,size)
    :sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
  return base.composite(composites).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
}

async function writeIcon(file,buffer){
  await fsp.writeFile(path.join(logoDir,file),buffer);
}

async function main(){
  const symbol=await buildSymbol();
  for(const size of ICON_SIZES){
    const ratio=size<=48?.94:size<=180?.92:.90;
    await writeIcon(`civweave-icon-${size}.png`,await renderIcon(symbol,size,ratio));
  }
  const app=await renderIcon(symbol,1024,.90);
  await writeIcon('civweave-app-icon.png',app);
  await writeIcon('civweave-icon-1024.png',app);
  for(const size of [192,512]){
    await writeIcon(`civweave-icon-maskable-${size}.png`,await renderIcon(symbol,size,.78));
  }
  await writeIcon('civweave-adaptive-foreground-512.png',await renderIcon(symbol,512,.92,{background:false}));
  const summary={
    schema:'civweave.icon-generation.v1',
    source:'civweave.webp',
    treatment:'tight-dark-centered-thread-mark',
    targetFill:{standard:'90-94%',maskable:'78%',adaptiveForeground:'92%'},
    generatedAt:new Date().toISOString(),
    files:[
      ...ICON_SIZES.map(size=>`civweave-icon-${size}.png`),
      'civweave-app-icon.png',
      'civweave-icon-maskable-192.png',
      'civweave-icon-maskable-512.png',
      'civweave-adaptive-foreground-512.png'
    ]
  };
  await fsp.writeFile(path.join(logoDir,'civweave-icon-generation.json'),JSON.stringify(summary,null,2));
  console.log(`[Civweave] Generated ${summary.files.length} tightly cropped Civweave icon assets.`);
}

main().catch(error=>{
  if(soft){
    console.warn(`[Civweave] Icon generation skipped: ${error.message}`);
    return;
  }
  console.error(error);
  process.exitCode=1;
});

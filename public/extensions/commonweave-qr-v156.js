(()=>{
'use strict';
const VERSION='1.0.4-v156';
const CONFIG=[null,
  {version:1,data:19,ecc:7,blocks:[19],align:[]},
  {version:2,data:34,ecc:10,blocks:[34],align:[6,18]},
  {version:3,data:55,ecc:15,blocks:[55],align:[6,22]},
  {version:4,data:80,ecc:20,blocks:[80],align:[6,26]},
  {version:5,data:108,ecc:26,blocks:[108],align:[6,30]},
  {version:6,data:136,ecc:18,blocks:[68,68],align:[6,34]}
];
const EXP=new Uint8Array(512),LOG=new Uint8Array(256);let primitive=1;
for(let i=0;i<255;i++){EXP[i]=primitive;LOG[primitive]=i;primitive<<=1;if(primitive&0x100)primitive^=0x11d}
for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
const multiply=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
function polyMultiply(a,b){const out=new Uint8Array(a.length+b.length-1);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)out[i+j]^=multiply(a[i],b[j]);return out}
function generator(degree){let result=Uint8Array.of(1);for(let i=0;i<degree;i++)result=polyMultiply(result,Uint8Array.of(1,EXP[i]));return result}
function remainder(data,degree){const gen=generator(degree),out=new Uint8Array(degree);for(const byte of data){const factor=byte^out[0];out.copyWithin(0,1);out[degree-1]=0;if(factor)for(let i=0;i<degree;i++)out[i]^=multiply(gen[i+1],factor)}return out}
function pushBits(target,value,length){for(let i=length-1;i>=0;i--)target.push((value>>>i)&1)}
function choose(bytes){for(let version=1;version<CONFIG.length;version++)if(bytes.length<=CONFIG[version].data-2)return CONFIG[version];throw new Error('The QR friend code is too long. Copy the code instead.')}
function codewords(text){const bytes=[...new TextEncoder().encode(String(text))],config=choose(bytes),bits=[];pushBits(bits,0b0100,4);pushBits(bits,bytes.length,8);for(const byte of bytes)pushBits(bits,byte,8);const capacity=config.data*8;for(let i=0;i<Math.min(4,capacity-bits.length);i++)bits.push(0);while(bits.length%8)bits.push(0);const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((value,bit)=>(value<<1)|bit,0));for(let pad=0;data.length<config.data;pad++)data.push(pad%2?0x11:0xec);const blocks=[];let offset=0;for(const length of config.blocks){blocks.push(data.slice(offset,offset+length));offset+=length}const ecc=blocks.map(block=>[...remainder(block,config.ecc)]),result=[];for(let i=0;i<Math.max(...blocks.map(block=>block.length));i++)for(const block of blocks)if(i<block.length)result.push(block[i]);for(let i=0;i<config.ecc;i++)for(const block of ecc)result.push(block[i]);return{config,result}}
function bchDigit(value){let digit=0;while(value){digit++;value>>>=1}return digit}
function formatBits(mask=0){const data=(1<<3)|mask;let value=data<<10;const generator=0x537;while(bchDigit(value)-bchDigit(generator)>=0)value^=generator<<(bchDigit(value)-bchDigit(generator));return((data<<10)|value)^0x5412}
function matrix(text){const {config,result}=codewords(text),size=21+(config.version-1)*4,cells=Array.from({length:size},()=>Array(size).fill(null)),functional=Array.from({length:size},()=>Array(size).fill(false));
  const set=(x,y,value,fn=true)=>{if(x<0||y<0||x>=size||y>=size)return;cells[y][x]=Boolean(value);if(fn)functional[y][x]=true};
  const finder=(left,top)=>{for(let y=-1;y<=7;y++)for(let x=-1;x<=7;x++){const inside=x>=0&&x<=6&&y>=0&&y<=6;const dark=inside&&(x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4));set(left+x,top+y,dark)}};
  finder(0,0);finder(size-7,0);finder(0,size-7);
  for(const cy of config.align)for(const cx of config.align){if(functional[cy]?.[cx])continue;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)set(cx+x,cy+y,Math.max(Math.abs(x),Math.abs(y))!==1)}
  for(let i=8;i<size-8;i++){if(cells[6][i]===null)set(i,6,i%2===0);if(cells[i][6]===null)set(6,i,i%2===0)}
  const reserveFormat=()=>{for(let i=0;i<15;i++){if(i<6)set(8,i,false);else if(i<8)set(8,i+1,false);else set(8,size-15+i,false);if(i<8)set(size-i-1,8,false);else if(i<9)set(15-i,8,false);else set(15-i-1,8,false)}set(8,size-8,true)};
  reserveFormat();
  const bytes=result;let byteIndex=0,bitIndex=7,row=size-1,direction=-1;
  for(let column=size-1;column>0;column-=2){if(column===6)column--;for(;;){for(let offset=0;offset<2;offset++){const x=column-offset,y=row;if(functional[y][x])continue;let dark=false;if(byteIndex<bytes.length)dark=((bytes[byteIndex]>>>bitIndex)&1)!==0;if((x+y)%2===0)dark=!dark;cells[y][x]=dark;bitIndex--;if(bitIndex<0){byteIndex++;bitIndex=7}}row+=direction;if(row<0||row>=size){row-=direction;direction=-direction;break}}}
  const format=formatBits(0);for(let i=0;i<15;i++){const dark=((format>>>i)&1)!==0;if(i<6)set(8,i,dark);else if(i<8)set(8,i+1,dark);else set(8,size-15+i,dark);if(i<8)set(size-i-1,8,dark);else if(i<9)set(15-i,8,dark);else set(15-i-1,8,dark)}set(8,size-8,true);
  return{version:config.version,size,cells};
}
function svg(text,{scale=5,margin=4,dark='#07111f',light='#ffffff'}={}){const qr=matrix(text),dimension=(qr.size+margin*2)*scale,paths=[];for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.cells[y][x])paths.push(`M${(x+margin)*scale} ${(y+margin)*scale}h${scale}v${scale}h-${scale}z`);return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${dimension}" height="${dimension}" role="img" aria-label="Commonweave friend QR code"><rect width="100%" height="100%" fill="${light}"/><path d="${paths.join('')}" fill="${dark}"/></svg>`}
function canvas(target,text,{scale=5,margin=4,dark='#07111f',light='#ffffff'}={}){const qr=matrix(text),dimension=(qr.size+margin*2)*scale;target.width=target.height=dimension;const context=target.getContext('2d');context.fillStyle=light;context.fillRect(0,0,dimension,dimension);context.fillStyle=dark;for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.cells[y][x])context.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);return qr}
globalThis.CommonweaveQRV156=Object.freeze({VERSION,matrix,svg,canvas});
})();

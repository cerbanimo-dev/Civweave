// Maggieverse reader: deterministic page/cue contracts; Spotify playback remains user-controlled.
export const CUE_SCHEMA = 'civweave.maggieverse-reader-cues.v1';
const MAX_BOOK_BYTES = 25 * 1024 * 1024;
const MAX_CHAPTER_BYTES = 6 * 1024 * 1024;
const MAX_CUE_COUNT = 1500;
const enc = new TextDecoder('utf-8');
const clean = (value, max=240) => String(value ?? '').replace(/\s+/g,' ').trim().slice(0,max);

export function fingerprint(value) {
  let hash=2166136261;
  const data=String(value ?? '');
  for (let i=0;i<data.length;i++) {
    hash ^= data.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function readerStorageKey(bookId) {
  const s=clean(bookId,130);
  return 'civweave.maggieverse-reader.v1.' + fingerprint(s) + '.' + s.length;
}
export function paginate(source, pageSize=2100) {
  const size=Math.max(360,Math.min(6000,Math.floor(Number(pageSize)||2100)));
  const text=String(source??'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if (!text) return [];
  if (text.length>6_000_000) throw new Error('Book text exceeds the 6 MB reader limit.');
  const pages=[];
  let offset=0;
  while(offset<text.length){
    let end=Math.min(offset+size,text.length);
    if (end<text.length) {
      const boundary=text.lastIndexOf(' ',end);
      const line=text.lastIndexOf('\n',end);
      const split=Math.max(boundary,line);
      if (split>offset+Math.round(size*.55)) end=split;
    }
    pages.push(text.slice(offset,end).trim());
    offset=end;
    while(offset<text.length && /\s/.test(text[offset])) offset++;
    if(pages.length>12000) throw new Error('Too many reader pages.');
  }
  return pages.filter(Boolean);
}
export function normalizeSpotify(value) {
  const raw=String(value??'').trim();
  let type,id;
  const uri=/^spotify:(playlist|track):([A-Za-z0-9]{22})$/.exec(raw);
  if(uri){type=uri[1];id=uri[2];}
  else {
    try {
      const u=new URL(raw);
      const parts=u.pathname.split('/').filter(Boolean);
      if(u.protocol!=='https:'||u.hostname!=='open.spotify.com'||parts.length!==2||!['track','playlist'].includes(parts[0])||! /^[A-Za-z0-9]{22}$/.test(parts[1])) return null;
      type=parts[0];id=parts[1];
    } catch {return null;}
  }
  return {type,id,url:'https://open.spotify.com/'+type+'/'+id,embed:'https://open.spotify.com/embed/'+type+'/'+id};
}
export function normalizeCue(input, pageCount) {
  if(!input||typeof input!=='object') return null;
  const count=Math.floor(Number(pageCount));
  if(!Number.isSafeInteger(count)||count<1||count>12000) return null;
  const kind=input.kind==='track'?'track':input.kind==='playlist'?'playlist':null;
  const spotify=normalizeSpotify(input.url);
  if(!kind||!spotify||kind!==spotify.type) return null;
  const startPage=Number(input.startPage),endPage=Number(input.endPage??input.startPage);
  if(!Number.isSafeInteger(startPage)||!Number.isSafeInteger(endPage)||startPage<1||endPage<startPage||endPage>count||(kind==='track'&&endPage!==startPage)) return null;
  const id=clean(input.id,90)||'cue-'+fingerprint([kind,startPage,endPage,spotify.id,clean(input.label,180)].join(':'));
  return {id,kind,startPage,endPage,url:spotify.url,label:clean(input.label,120)|| (kind==='track'?'Song cue':'Playlist'),note:clean(input.note,340)};
}
export function activeCues(cues, page) {
  const index=Number(page);
  return Array.isArray(cues)?cues.filter(c=>c && c.startPage<=index&&c.endPage>=index):[];
}
export function chooseCue(cues, page) {
  const matches=activeCues(cues,page);
  return matches.sort((a,b)=>{
    const score=c=>(c.kind==='track'?100000:0) + (10000-(c.endPage-c.startPage));
    return score(b)-score(a);
  })[0]||null;
}
export function exportCueSheet(bookId,cues,pageCount) {
  const arr=(Array.isArray(cues)?cues:[]).map(c=>normalizeCue(c,pageCount)).filter(Boolean).slice(0,MAX_CUE_COUNT);
  return JSON.stringify({schema:CUE_SCHEMA,version:1,bookId:clean(bookId,250),pageCount,cues:arr},null,2);
}
export function importCueSheet(raw,bookId,pageCount) {
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(!data||data.schema!==CUE_SCHEMA||!Array.isArray(data.cues)||data.cues.length>MAX_CUE_COUNT) throw new Error('Not a Maggieverse cue sheet.');
  if(data.bookId!==clean(bookId,250)) throw new Error('This cue sheet belongs to a different book or edition.');
  if(data.pageCount!==pageCount) throw new Error('Page count changed. Import the exact edition used when authoring cues.');
  const out=[];
  for(const value of data.cues){
    const cue=normalizeCue(value,pageCount);
    if(!cue) throw new Error('Cue sheet contains an invalid range or Spotify URL.');
    out.push(cue);
  }
  return out;
}
const joinPath=(base,href)=>{
  const parts=[];
  const name=String(href||'').split('#')[0].split('?')[0];
  const decoded=decodeURIComponent(name);
  if(decoded.startsWith('/')||decoded.includes('\\')) throw new Error('Unsafe EPUB path.');
  for(const segment of (base+'/'+decoded).split('/')){
    if(!segment||segment==='.') continue;
    if(segment==='..'){if(!parts.length) throw new Error('Unsafe EPUB path.');parts.pop();continue;}
    parts.push(segment);
  }
  return parts.join('/');
};
const parentPath = path => path.slice(0,Math.max(0,path.lastIndexOf('/')));
const xml = text => {
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('EPUB contains malformed XML.');
  return doc;
};
async function inflateRaw(source, limit){
  if(typeof DecompressionStream!=='function') throw new Error('EPUB decompression is not available in this browser. Please use a recent browser or import TXT.');
  const stream=new Blob([source]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader=stream.getReader(),parts=[]; let length=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      length+=value.byteLength;
      if(length>limit) throw new Error('EPUB chapter expands beyond the size limit.');
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const result=new Uint8Array(length); let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.byteLength;}
  return result;
}
async function zipEntries(file){
  if(file.size>MAX_BOOK_BYTES) throw new Error('EPUB is larger than 25 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const view=new DataView(bytes.buffer), len=bytes.length;
  let eocd=-1;
  for(let i=len-22;i>=Math.max(0,len-65557);i--){
    if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
  }
  if(eocd<0) throw new Error('EPUB ZIP directory not found.');
  const count=view.getUint16(eocd+10,true),dir=view.getUint32(eocd+16,true);
  if(count<1||count>3000||dir>=len) throw new Error('Unsupported EPUB ZIP directory.');
  const entries=new Map(); let pos=dir;
  for(let i=0;i<count;i++){
    if(pos+46>len||view.getUint32(pos,true)!==0x02014b50) throw new Error('Invalid EPUB ZIP entry.');
    const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true);
    const compressed=view.getUint32(pos+20,true),uncompressed=view.getUint32(pos+24,true);
    const nameLen=view.getUint16(pos+28,true),extraLen=view.getUint16(pos+30,true),commentLen=view.getUint16(pos+32,true);
    const local=view.getUint32(pos+42,true);
    const next=pos+46+nameLen+extraLen+commentLen;
    if(next>len||flags&1||compressed>MAX_BOOK_BYTES||uncompressed>MAX_CHAPTER_BYTES||local+30>len||![0,8].includes(method)) throw new Error('Unsupported or oversized EPUB entry.');
    const path=enc.decode(bytes.subarray(pos+46,pos+46+nameLen));
    if(path&&!path.endsWith('/'))entries.set(path,{method,compressed,uncompressed,local});
    pos=next;
  }
  const read=async path=>{
    const info=entries.get(path);if(!info) throw new Error('Missing EPUB entry: '+path);
    const {local,compressed,uncompressed,method}=info;
    if(view.getUint32(local,true)!==0x04034b50) throw new Error('Invalid EPUB local entry.');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(start+compressed>len)throw new Error('Truncated EPUB entry.');
    const source=bytes.subarray(start,start+compressed);
    const result=method===0?source:await inflateRaw(source,MAX_CHAPTER_BYTES);
    if(result.byteLength!==uncompressed) throw new Error('Incorrect EPUB entry length.');
    return enc.decode(result);
  };
  return {read};
}
function xhtmlText(markup){
  const doc=new DOMParser().parseFromString(markup,'text/html');
  doc.querySelectorAll('script,style,template,svg,iframe,object,nav').forEach(node=>node.remove());
  const body=doc.body;
  const paragraphs=[...body.querySelectorAll('h1,h2,h3,h4,h5,p,blockquote,li')].filter(node=> !node.parentElement?.closest('li,blockquote'));
  const result=paragraphs.map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n\n');
  return result||body.textContent.replace(/\s+/g,' ').trim();
}
export async function readBook(file){
  if(!(file instanceof File)) throw new Error('Select a local EPUB or TXT file.');
  if(file.size>MAX_BOOK_BYTES) throw new Error('Book is larger than 25 MB.');
  const name=clean(file.name,180);
  if(/\.txt$/i.test(name)||/\.md$/i.test(name)){
    const source=await file.text();
    const text=source.slice(0,6_000_000);
    if(!text.trim())throw new Error('File contains no readable text.');
    return {title:name.replace(/\.(txt|md)$/i,''),text,bookId:fingerprint(name+':'+text.length+':'+text.slice(0,5000)+':'+text.slice(-5000))};
  }
  if(!/\.epub$/i.test(name))throw new Error('Only EPUB, TXT and MD books are supported.');
  const archive=await zipEntries(file);
  const container=xml(await archive.read('META-INF/container.xml'));
  const opf=container.querySelector('rootfile')?.getAttribute('full-path');
  if(!opf)throw new Error('EPUB package location missing.');
  const path=joinPath('',opf);
  const packageDoc=xml(await archive.read(path));
  const title=clean(packageDoc.querySelector('title')?.textContent||name.replace(/\.epub$/i,''),180);
  const refs=new Map([...packageDoc.querySelectorAll('manifest > item')].map(node=>[node.getAttribute('id'),{href:node.getAttribute('href'),type:node.getAttribute('media-type')}]));
  const sections=[];let length=0;
  for(const item of packageDoc.querySelectorAll('spine > itemref')){
    const ref=refs.get(item.getAttribute('idref'));
    if(!ref||!ref.href||!/(xhtml|html)/i.test(ref.type||''))continue;
    const chapter=xhtmlText(await archive.read(joinPath(parentPath(path),ref.href)));
    if(!chapter) continue;
    length+=chapter.length;
    if(length>6_000_000)throw new Error('EPUB text is larger than the 6 MB reader limit.');
    sections.push(chapter);
  }
  const text=sections.join('\n\n');
  if(!text)throw new Error('No readable EPUB chapters were found.');
  return {title,text,bookId:fingerprint(name+':'+text.length+':'+text.slice(0,5000)+':'+text.slice(-5000))};
}


// Fruit of the Loom / Golden Path: an optional, local, reversible reading overlay.
// It does not rewrite books, upload manuscripts, rate age suitability, or use AI.
export const GOLDEN_PATH_SCHEMA='civweave.reader-golden-path.v1';
const GOLDEN_INVITATIONS=Object.freeze([
  'What did you notice along this part of the journey?',
  'What question would you like to explore?',
  'What changed since the last waypoint?',
  'What could someone learn or share here?',
  'Where would you like to travel in the story next?'
]);
const goldenTitle=line=>{
  const text=String(line??'').trim();
  if(text.length>90)return '';
  const markdown=/^#{1,4}\s+(.{2,80})$/.exec(text);
  if(markdown)return markdown[1].trim();
  return /^(?:(?:chapter|part|book|interlude)\s+[a-z0-9ivxlcdm]+(?:\s*[:.\u2014\u2013-]\s*.+)?|prologue|epilogue)$/i.test(text)?text:'';
};
export function buildGoldenPath(pages) {
  if(!Array.isArray(pages)||!pages.length||pages.length>12000||pages.some(p=>typeof p!=='string'))
    throw new Error('Golden Path requires 1 to 12000 readable pages.');
  const count=pages.length,headings=[];
  for(let i=0;i<count;i++){
    // Examine the page's existing line breaks; never invent text or modify the book.
    const lines=pages[i].slice(0,6000).split(/\r?\n/);
    for(const line of lines){
      const title=goldenTitle(line);
      if(title){headings.push({page:i+1,title});break;}
    }
  }
  const starts=[{page:1,title:'The Threshold',kind:'start'}];
  if(headings.length>=2){
    // Keep the path compact even for books with hundreds of chapters.
    const later=headings.filter(h=>h.page>1);
    const stride=Math.max(1,Math.ceil(later.length/22));
    for(let i=0;i<later.length;i+=stride)
      starts.push({...later[i],kind:'chapter'});
  }else{
    for(const [fraction,title] of [[0.25,'First Threads'],[0.5,'The Turning'],[0.75,'New Horizons']]){
      starts.push({page:Math.max(1,Math.ceil(count*fraction)),title,kind:'waypoint'});
    }
  }
  starts.push({page:count,title:'The Horizon',kind:'finish'});
  const unique=new Map();
  for(const stop of starts)if(!unique.has(stop.page))unique.set(stop.page,stop);
  const ordered=[...unique.values()].sort((a,b)=>a.page-b.page);
  const stops=ordered.map((stop,index)=>({
    page:stop.page,title:stop.title,kind:stop.kind,
    invitation:GOLDEN_INVITATIONS[index%GOLDEN_INVITATIONS.length]
  }));
  return {schema:GOLDEN_PATH_SCHEMA,pageCount:count,stops};
}
export function goldenWaypointForPage(path,page){
  if(!path||path.schema!==GOLDEN_PATH_SCHEMA||!Array.isArray(path.stops)||!path.stops.length)return null;
  const number=Math.max(1,Math.min(path.pageCount,Math.floor(Number(page)||1)));
  let active=path.stops[0];
  for(const stop of path.stops){if(stop.page>number)break;active=stop;}
  return active;
}

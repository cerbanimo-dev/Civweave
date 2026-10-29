import {validateDraft,externalUrl} from './living-library-seedling-core-v1.mjs';
const enc=new TextEncoder(),xml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clean=(v,n=4000)=>String(v??'').trim().slice(0,n),bytes=v=>typeof v==='string'?enc.encode(v):v;
const u16=(a,o,v)=>{a[o]=v&255;a[o+1]=(v>>>8)&255},u32=(a,o,v)=>{a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255};
const crc32=data=>{let c=-1;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^-1)>>>0};
export function zipStored(files){
 if(files.length>65535)throw Error('Too many files');
 const pieces=[],directory=[];let at=0;
 for(const f of files){
  const name=bytes(f.name),data=bytes(f.content);if(name.length>65535||data.length>0xffffffff)throw Error('EPUB entry too large');
  const hash=crc32(data),local=new Uint8Array(30+name.length),central=new Uint8Array(46+name.length);
  u32(local,0,0x04034b50);u16(local,4,20);u16(local,6,0x0800);u32(local,14,hash);u32(local,18,data.length);u32(local,22,data.length);u16(local,26,name.length);local.set(name,30);
  u32(central,0,0x02014b50);u16(central,4,20);u16(central,6,20);u16(central,8,0x0800);u32(central,16,hash);u32(central,20,data.length);u32(central,24,data.length);u16(central,28,name.length);u32(central,42,at);central.set(name,46);
  pieces.push(local,data);directory.push(central);at+=local.length+data.length;
 }
 const length=directory.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);u32(end,12,length);u32(end,16,at);
 const output=new Uint8Array(at+length+end.length);let offset=0;for(const p of [...pieces,...directory,end]){output.set(p,offset);offset+=p.length}return output;
}
const css='body{font-family:serif;line-height:1.5;max-width:42em;margin:0 auto}h1,h2{line-height:1.25}p{margin:.6em 0 1em}figure{text-align:center;margin:1em auto}img{max-width:100%;height:auto}figcaption{font-size:.85em}a{color:inherit;text-decoration:underline}';
const doc=(title,body)=>'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><head><title>'+xml(title)+'</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>'+body+'</body></html>';
const paragraph=v=>xml(clean(v)).replace(/\r?\n/g,'<br/>');
const safeUrl=v=>externalUrl(v)?xml(externalUrl(v)):null;
function validateImage(image){
 if(!(image.bytes instanceof Uint8Array)||image.bytes.length>6000000||image.bytes.length<4)throw Error('A selected image must be at most 6 MB and contain bytes.');
 const png=image.bytes[0]===137&&image.bytes[1]===80&&image.bytes[2]===78&&image.bytes[3]===71;
 const jpeg=image.bytes[0]===255&&image.bytes[1]===216&&image.bytes[2]===255;
 const ext=String(image.name||'').toLowerCase().split('.').pop();
 if(ext==='png'&&png)return'png';if(['jpg','jpeg'].includes(ext)&&jpeg)return'jpg';
 throw Error('Offline image must be a valid PNG or JPEG.');
}
export function exportSeedlingEpub(draft,{images=[]}={}){
 const issues=validateDraft(draft);if(issues.length)throw Error(issues.join(' '));
 const imgs=new Map(),files=[{name:'mimetype',content:'application/epub+zip'},{name:'META-INF/container.xml',content:'<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'}];
 const manifest=[],spine=[],chapters=[],media=draft.media||[];
 for(const img of images){
  if(imgs.has(img.mediaId)||!media.some(m=>m.id===img.mediaId&&m.kind==='image'))continue;
  const ext=validateImage(img),name='image'+(imgs.size+1)+'.'+ext;
  imgs.set(img.mediaId,name);files.push({name:'OEBPS/images/'+name,content:img.bytes});
  manifest.push('<item id="image'+imgs.size+'" href="images/'+name+'" media-type="image/'+(ext==='jpg'?'jpeg':'png')+'"/>');
 }
 const renderMedia=m=>{
  const local=imgs.get(m.id);if(local)return'<figure><img src="images/'+local+'" alt="'+xml(m.title||'Illustration')+'"/><figcaption>'+xml([m.title,m.credit].filter(Boolean).join(' — '))+'</figcaption></figure>';
  const url=safeUrl(m.url);return url?'<p><strong>'+xml(m.kind)+': </strong><a href="'+url+'">'+xml(m.title||m.url)+'</a> (external link, not available offline)</p>':'';
 };
 const sources=arr=>'<ol>'+arr.map(s=>'<li><a href="'+safeUrl(s.url)+'">'+xml(s.title||s.url)+'</a>'+(s.creator?' — '+xml(s.creator):'')+(s.notes?'<p>'+paragraph(s.notes)+'</p>':'')+'</li>').join('')+'</ol>';
 const add=(name,title,body)=>chapters.push({name,title,body});
 add('start.xhtml','Start here','<h1>'+xml(draft.title)+'</h1><p>Living Library: Seedling Edition · Offline Learning Journey review outline</p><h2>Capability</h2><p>'+paragraph(draft.capability)+'</p><h2>Proof</h2><p>'+paragraph(draft.proof)+'</p><h2>Modules</h2><ol>'+draft.modules.map((m,i)=>'<li><a href="module'+(i+1)+'.xhtml">'+xml(m.title)+'</a></li>').join('')+'</ol><p>Reading this plan does not approve it, generate lessons, spend AI credits, or publish it to a Guild.</p>');
 draft.modules.forEach((m,i)=>add('module'+(i+1)+'.xhtml',m.title,
 '<h1>Module '+(i+1)+': '+xml(m.title)+'</h1><h2>Focus</h2><p>'+paragraph(m.focus)+'</p><h2>Demonstration</h2><p>'+paragraph(m.outcome)+'</p><h2>Media</h2>'+
 media.filter(a=>a.moduleId===m.id).map(renderMedia).join('')+'<h2>References</h2>'+sources((draft.sources||[]).filter(s=>s.moduleId===m.id))));
 add('references.xhtml','Sources and media','<h1>All references</h1>'+sources(draft.sources||[])+'<h2>General media</h2>'+media.filter(a=>!a.moduleId).map(renderMedia).join('')+'<h2>Media rights</h2>'+media.map(m=>'<p>'+xml(m.title||m.kind)+': '+xml(m.rights||'Rights not verified')+'</p>').join(''));
 chapters.forEach((ch,i)=>{files.push({name:'OEBPS/'+ch.name,content:doc(ch.title,ch.body)});manifest.push('<item id="ch'+i+'" href="'+ch.name+'" media-type="application/xhtml+xml"/>');spine.push('<itemref idref="ch'+i+'"/>')});
 files.push({name:'OEBPS/style.css',content:css});
 files.push({name:'OEBPS/nav.xhtml',content:doc('Contents','<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc" id="toc"><h1>Contents</h1><ol>'+chapters.map(c=>'<li><a href="'+c.name+'">'+xml(c.title)+'</a></li>').join('')+'</ol></nav>')});
 const id=clean(draft.id,120).replace(/[^A-Za-z0-9_-]/g,'_');
 const opf='<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:civweave:seedling:'+id+'</dc:identifier><dc:title>'+xml(draft.title)+'</dc:title><dc:creator>Living Library: Seedling Edition</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">'+new Date().toISOString().replace(/\.\d+Z$/,'Z')+'</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="style" href="style.css" media-type="text/css"/>'+manifest.join('')+'</manifest><spine>'+spine.join('')+'</spine></package>';
 files.push({name:'OEBPS/content.opf',content:opf});
 return zipStored(files);
}

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTPUT=path.join(ROOT,'public/app/radio-track-map-v241.json');
const DIRECTORIES={
  anarchadia:'public/app/radio-directory-v240/anarchadia.txt',
  cerbanimo:'public/app/radio-directory-v240/cerbanimo.txt',
  'living-school':'public/app/radio-directory-v240/living-school.txt',
  fellowfare:'public/app/radio-directory-v240/fellowfare.txt',
  civweave:'public/app/radio-directory-v240/civweave.txt'
};
const PLAYLISTS={
  anarchadia:'2AsCLZiAPlUYHOcogllTia',
  cerbanimo:'1CB3LLMSnuDwD013B1ZY3M',
  'living-school':'2MwmQdjHyRBIu8Wy9iXWUm',
  fellowfare:'1q6YDYRU6hekl2MkHkI2X3',
  civweave:'2BLWIhSfHdbcfG5rP8IqoX'
};
const args=new Set(process.argv.slice(2));
const requestedSystem=process.argv.slice(2).find(value=>value.startsWith('--system='))?.slice('--system='.length)||'';
const write=args.has('--write');
const allowLabelMismatch=args.has('--allow-label-mismatch');
const token=String(process.env.SPOTIFY_ACCESS_TOKEN||'').trim();

if(!token){
  throw new Error('SPOTIFY_ACCESS_TOKEN is required. Use an owner/collaborator-authorized Spotify user token; the token is read from the environment and is never written to disk.');
}
if(requestedSystem&&!PLAYLISTS[requestedSystem]){
  throw new Error(`Unknown --system=${requestedSystem}. Expected one of: ${Object.keys(PLAYLISTS).join(', ')}`);
}

function normalized(value){
  return String(value||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/gi,'')
    .toLowerCase();
}
function spotifyLabel(item){
  const artists=Array.isArray(item?.artists)?item.artists.map(artist=>artist?.name).filter(Boolean):[];
  return `${artists.join(',')} - ${item?.name||''}`;
}
function itemFrom(entry){return entry?.item||entry?.track||null}

async function fetchPlaylistItems(playlistId){
  const items=[];
  let offset=0;
  while(true){
    const url=new URL(`https://api.spotify.com/v1/playlists/${playlistId}/items`);
    url.searchParams.set('limit','50');
    url.searchParams.set('offset',String(offset));
    url.searchParams.set('additional_types','track');
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok){
      const detail=await response.text().catch(()=> '');
      throw new Error(`Spotify playlist ${playlistId} returned ${response.status}. ${detail.slice(0,500)}`);
    }
    const page=await response.json();
    const pageItems=Array.isArray(page?.items)?page.items:[];
    items.push(...pageItems);
    if(!page?.next||pageItems.length===0)break;
    offset+=pageItems.length;
  }
  return items;
}

async function readDirectory(system){
  const text=await fs.readFile(path.join(ROOT,DIRECTORIES[system]),'utf8');
  return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>line.split('\t')[0].trim());
}

async function syncSystem(system){
  const labels=await readDirectory(system);
  const entries=await fetchPlaylistItems(PLAYLISTS[system]);
  if(entries.length!==labels.length){
    throw new Error(`${system}: playlist has ${entries.length} items but the local station directory has ${labels.length}. Refusing to map IDs by position.`);
  }
  const ids=[];
  const mismatches=[];
  for(let index=0;index<labels.length;index++){
    const item=itemFrom(entries[index]);
    if(!item?.id){
      throw new Error(`${system}: item ${index+1} has no Spotify track ID (local file, episode, removed item, or unavailable item).`);
    }
    const remoteLabel=spotifyLabel(item);
    if(normalized(labels[index])!==normalized(remoteLabel)){
      mismatches.push({position:index+1,local:labels[index],spotify:remoteLabel,id:item.id});
    }
    ids.push(item.id);
  }
  if(mismatches.length&&!allowLabelMismatch){
    console.error(JSON.stringify({system,mismatches},null,2));
    throw new Error(`${system}: ${mismatches.length} label mismatch(es). Re-run only after inspecting them, or pass --allow-label-mismatch to accept position-based mapping.`);
  }
  return {
    playlistId:PLAYLISTS[system],
    trackCount:ids.length,
    tracks:ids,
    mismatches
  };
}

const systems=requestedSystem?[requestedSystem]:Object.keys(PLAYLISTS);
const manifest={
  version:1,
  revision:'radio-track-map-v241',
  generatedAt:new Date().toISOString(),
  systems:{}
};
for(const system of systems){
  manifest.systems[system]=await syncSystem(system);
  console.log(`${system}: mapped ${manifest.systems[system].trackCount} Spotify track IDs.`);
}

if(requestedSystem){
  let existing={version:1,revision:'radio-track-map-v241',generatedAt:null,systems:{}};
  try{existing=JSON.parse(await fs.readFile(OUTPUT,'utf8'))}catch{}
  manifest.systems={...(existing?.systems||{}),...manifest.systems};
}

if(write){
  await fs.writeFile(OUTPUT,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
  console.log(`Wrote ${path.relative(ROOT,OUTPUT)}.`);
}else{
  console.log('Dry run only. Re-run with --write to update the local track-ID manifest.');
}

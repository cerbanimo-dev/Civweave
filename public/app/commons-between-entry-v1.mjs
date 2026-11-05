import {COMMONS_BETWEEN,COMMONS_BETWEEN_ID} from './shared/worldweaver-universe-v1.mjs';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const guildId=(params.get('guild')||'').trim().slice(0,180);
const guildName=(params.get('name')||'').trim().slice(0,180);
const safeKey=value=>value.replace(/[^A-Za-z0-9:_-]/g,'_').slice(0,180);
const storageKey='civweave.commons-between.last-room.v1.'+safeKey(guildId||'standalone');

function loadLastRoom(){
  try{return localStorage.getItem(storageKey)||COMMONS_BETWEEN.rooms[0]?.id||null}catch{return COMMONS_BETWEEN.rooms[0]?.id||null}
}
function saveLastRoom(roomId){try{localStorage.setItem(storageKey,roomId)}catch{}}
let activeRoom=loadLastRoom();
if(!COMMONS_BETWEEN.rooms.some(room=>room.id===activeRoom))activeRoom=COMMONS_BETWEEN.rooms[0]?.id||null;

function render(){
  $('entry-status-title').textContent=guildName?guildName:(guildId?'Selected Guild':'Standalone local universe');
  $('guild-meta').textContent=guildId
    ?'Guild scope · '+guildId+' · room state is remembered on this device.'
    :'No Guild identifier was supplied. This is a standalone local entry.';
  $('portal-count').textContent=COMMONS_BETWEEN.storyPortals.count+' Door & Dawn story portals';
  $('universe-foot').textContent='Blueprint '+COMMONS_BETWEEN.schema+' · '+COMMONS_BETWEEN.title+' · '+COMMONS_BETWEEN.status;
  const host=$('rooms');host.replaceChildren();
  for(const room of COMMONS_BETWEEN.rooms){
    const article=document.createElement('article');
    article.className='room'+(room.id===activeRoom?' active':'');
    const h=document.createElement('h2');h.textContent=room.title;
    const p=document.createElement('p');p.textContent=room.description;
    const meta=document.createElement('div');meta.className='meta';meta.textContent=room.guide+' · '+room.stations.length+' stations · '+room.screens.length+' screen';
    const button=document.createElement('button');button.type='button';
    button.textContent=room.id===activeRoom?'You are here':'Enter room';
    button.setAttribute('aria-pressed',room.id===activeRoom?'true':'false');
    button.addEventListener('click',()=>{activeRoom=room.id;saveLastRoom(activeRoom);render();dispatchEvent(new CustomEvent('civweave:commons-between-room',{detail:{guildId:guildId||null,universeId:COMMONS_BETWEEN_ID,roomId:activeRoom}}))});
    article.append(h,p,meta,button);host.append(article);
  }
}
render();

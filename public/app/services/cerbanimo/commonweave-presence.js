(()=>{
'use strict';
const VERSION='1.0.0-rc21.4',KEY='commonweave.presence.v2',SELF='commonweave.presence.self.v2',VIS='commonweave.presence.visibility.v1';
const safe=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const vault=safe('commonweave-identity-vault',{}),id=vault?.identity?.identityId||safe(SELF,{})?.id||crypto.randomUUID?.()||String(Date.now());
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('commonweave-presence-v2'):null;
const visibility=()=>localStorage.getItem(VIS)||'party';
let self={id,name:vault?.identity?.displayName||'Local traveler',initials:(vault?.identity?.displayName||'LT').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),avatar:vault?.identity?.avatar||'',scene:localStorage.getItem('commonweave-world-scene')||'square',system:document.documentElement.dataset.commonweaveSystem||'commonweave',activity:'Exploring Commonweave',visibility:visibility(),partyId:localStorage.getItem('commonweave.active-party.v1')||'',communityId:localStorage.getItem('commonweave-pocket-community')||'',updatedAt:new Date().toISOString()};
function visibleToMe(p){if(p.visibility==='public')return true;if(p.visibility==='private')return false;if(p.visibility==='community')return Boolean(p.communityId&&p.communityId===self.communityId);return Boolean(p.partyId&&p.partyId===self.partyId)||p.id===self.id}
function peers(){const cutoff=Date.now()-90000;return safe(KEY,[]).filter(p=>Date.parse(p.updatedAt)>cutoff&&p.id!==id&&visibleToMe(p))}
function snapshot(){return {version:VERSION,self:{...self},peers:peers(),visibilityOptions:['private','party','community','public']}}
function publish(patch={}){self={...self,...patch,id,visibility:patch.visibility||visibility(),updatedAt:new Date().toISOString()};save(SELF,self);const all=[self,...safe(KEY,[]).filter(x=>x.id!==id&&Date.parse(x.updatedAt)>Date.now()-90000)].slice(0,100);save(KEY,all);channel?.postMessage(self);window.dispatchEvent(new CustomEvent('commonweave:presence',{detail:snapshot()}));return self}
function setVisibility(level){if(!['private','party','community','public'].includes(level))return self;localStorage.setItem(VIS,level);return publish({visibility:level})}
function receive(p){if(!p?.id||p.id===id)return;const all=[p,...safe(KEY,[]).filter(x=>x.id!==p.id&&x.id!==id),self].slice(0,100);save(KEY,all);window.dispatchEvent(new CustomEvent('commonweave:presence',{detail:snapshot()}))}
channel&&(channel.onmessage=e=>receive(e.data));window.addEventListener('storage',e=>{if(e.key===KEY)window.dispatchEvent(new CustomEvent('commonweave:presence',{detail:snapshot()}))});
setInterval(()=>publish(),30000);publish();
window.CommonweavePresence={VERSION,publish,snapshot,peers,setVisibility};
})();

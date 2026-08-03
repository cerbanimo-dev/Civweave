(()=>{
'use strict';
const TARGET='/app/anarchadia-governance-v145.html';
let queued=false;
function open(proposalId=''){const query=proposalId?`?proposal=${encodeURIComponent(proposalId)}`:'';location.assign(TARGET+query)}
function mountModule(){
  const grid=document.querySelector('.ac-grid');if(!grid||grid.querySelector('[data-ag145-open]'))return;
  const button=document.createElement('button');button.className='ac-module is-cyan';button.type='button';button.dataset.ag145Open='';
  button.innerHTML='<span class="ac-icon">⚖</span><span><b>GOVERNED UPDATE</b><small>Groups, nodes, consent, ballots, signed branch authorization.</small></span><i>›</i>';
  grid.append(button);
}
function mountProposalButtons(){
  document.querySelectorAll('[data-signal-vote]').forEach(signal=>{
    const id=signal.dataset.signalVote,actions=signal.closest('.ac-card-actions');if(!actions||actions.querySelector(`[data-ag145-open="${CSS.escape(id)}"]`))return;
    signal.textContent=signal.textContent.includes('SUPPORT')?'SUPPORT SIGNALLED':'LOCAL SUPPORT';
    const button=document.createElement('button');button.type='button';button.dataset.ag145Open=id;button.textContent='GOVERN';actions.insertBefore(button,signal);
  });
}
function mountFeatures(){
  const menu=document.querySelector('.ch142-feature-menu');if(!menu||menu.querySelector('[data-ag145-feature-group]'))return;
  const section=document.createElement('section');section.className='ch142-feature-group';section.dataset.ag145FeatureGroup='v145';
  section.innerHTML='<h3>Governed self-update</h3><button type="button" class="ch142-feature" data-ag145-open><span><b>Consent, ballots & execution</b><small>Turn a validated request into a hash-bound group or federation decision and a branch-only execution packet.</small></span><em>Open</em></button>';
  menu.append(section);
}
function mount(){mountModule();mountProposalButtons();mountFeatures()}
function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount()})}
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-ag145-open]');
  if(target){event.preventDefault();event.stopImmediatePropagation();open(target.dataset.ag145Open||'');return}
  const vote=event.target.closest('[data-action="vote-hub"]');
  if(vote){event.preventDefault();event.stopImmediatePropagation();const latest=[...document.querySelectorAll('[data-preview]')].at(-1)?.dataset.preview||'';open(latest)}
},true);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('DOMContentLoaded',queue,{once:true});queue();
globalThis.AnarchadiaGovernanceBridgeV145={open,mount};
})();

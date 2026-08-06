(()=>{
'use strict';
const VERSION='1.0.33-governance-bridge-stable';
if(globalThis.AnarchadiaGovernanceBridgeV145?.version===VERSION)return;
const TARGET='/app/anarchadia-governance-v145.html';let attempts=0,timer=0;
function open(proposalId=''){const query=proposalId?`?proposal=${encodeURIComponent(proposalId)}`:'';location.assign(TARGET+query)}
function mountModule(){const grid=document.querySelector('.ac-grid');if(!grid||grid.querySelector('[data-ag145-open]'))return false;const button=document.createElement('button');button.className='ac-module is-cyan';button.type='button';button.dataset.ag145Open='';button.innerHTML='<span class="ac-icon">⚖</span><span><b>GOVERNED UPDATE</b><small>Consent, ballots, signed branch authorization.</small></span><i>›</i>';grid.append(button);return true}
function mountProposalButtons(){let changed=false;document.querySelectorAll('[data-signal-vote]').forEach(signal=>{const id=signal.dataset.signalVote,actions=signal.closest('.ac-card-actions');if(!actions||actions.querySelector(`[data-ag145-open="${CSS.escape(id)}"]`))return;signal.textContent=signal.textContent.includes('SUPPORT')?'SUPPORT SIGNALLED':'LOCAL SUPPORT';const button=document.createElement('button');button.type='button';button.dataset.ag145Open=id;button.textContent='GOVERN';actions.insertBefore(button,signal);changed=true});return changed}
function mount(){mountModule();mountProposalButtons()}
function schedule(){clearTimeout(timer);if(attempts++>20)return;timer=setTimeout(()=>{mount();if(!document.querySelector('.ac-grid'))schedule()},Math.min(500,40+attempts*20))}
if(document.documentElement.dataset.ag145Bound!=='true'){document.documentElement.dataset.ag145Bound='true';document.addEventListener('click',event=>{const target=event.target.closest('[data-ag145-open]');if(target){event.preventDefault();event.stopImmediatePropagation();open(target.dataset.ag145Open||'');return}const vote=event.target.closest('[data-action="vote-hub"]');if(vote){event.preventDefault();event.stopImmediatePropagation();const latest=[...document.querySelectorAll('[data-preview]')].at(-1)?.dataset.preview||'';open(latest)}},true);addEventListener('cerbanimo:noop',mount);addEventListener('anarchadia:console-changed',mount);addEventListener('storage',event=>{if(event.key==='civweave.anarchadia.citizen-console.v139')mount()})}
document.readyState==='loading'?addEventListener('DOMContentLoaded',schedule,{once:true}):schedule();
globalThis.AnarchadiaGovernanceBridgeV145={version:VERSION,open,mount};
})();

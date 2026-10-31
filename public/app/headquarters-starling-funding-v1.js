/**
 * The ONLY purchase surface for headquarters-only Starling inference backing.
 * This is presentation over the canonical Cloudflare Money Edge, not a wallet.
 */
(() => {
'use strict';
const ORIGIN='https://civweave.cc';
const ENDPOINT='https://civweave-core.cerbanimo.workers.dev/api/money-edge/headquarters/starling-funding';
const $=id=>document.getElementById(id);
const money=cents=>'$'+(Number(cents)/100).toFixed(2);
let policy=null;
function message(value){const node=$('cw-starling-fund-message');if(node)node.textContent=value;}
function displayTotals(){
  const amount=$('cw-starling-fund-total');
  if(!amount || !policy)return;
  amount.textContent='Previously funded for future inference: '+money(policy.fundedCents||0);
}
async function refresh(){
  const res=await fetch(ENDPOINT,{method:'GET',mode:'cors',cache:'no-store',headers:{accept:'application/json'}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok||body.schema!=='civweave.headquarters-starling-funding.v1')throw new Error('Funding status unavailable.');
  policy=body;
  const pay=$('cw-starling-fund-pay');
  if(pay)pay.disabled=!body.enabled;
  displayTotals();
  if(!body.enabled)message('Contribution checkout is not enabled yet. No payment will be taken.');
  else message('Secure Stripe checkout. Payment is credited only after verification; no personal AI credits or membership are issued.');
}
function selectedAmount(){
  const custom=$('cw-starling-fund-custom');
  const choice=document.querySelector('input[name="cw-starling-fund-choice"]:checked');
  if(choice?.value!=='custom')return Number(choice?.value||500);
  const dollars=Number(custom?.value);
  if(!Number.isSafeInteger(dollars)||dollars<5||dollars>1000)throw new Error('Choose a whole dollar amount from $5 to $1,000.');
  return dollars*100;
}
async function submit(event){
  event.preventDefault();
  const btn=$('cw-starling-fund-pay');
  if(!policy?.enabled){message('Contribution checkout is unavailable.');return;}
  if(btn)btn.disabled=true;
  try{
    const amountCents=selectedAmount();
    message('Opening Stripe checkout…');
    const key=crypto.randomUUID().replaceAll('-','');
    const res=await fetch(ENDPOINT,{
      method:'POST',mode:'cors',cache:'no-store',headers:{'content-type':'application/json'},
      body:JSON.stringify({amountCents,idempotencyKey:key})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(String(data.error||'Checkout unavailable.').slice(0,400));
    const url=new URL(String(data.checkout?.checkoutUrl||''));
    if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Untrusted payment destination.');
    location.assign(url.href);
  }catch(error){
    message(error.message||'Checkout could not be opened.');
    if(btn)btn.disabled=false;
  }
}
function open(){
  const dialog=$('cw-starling-fund-dialog');if(!dialog)return;
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.hidden=false;
  message('Checking secure payment availability…');
  refresh().catch(error=>{policy=null;const pay=$('cw-starling-fund-pay');if(pay)pay.disabled=true;message(error.message||'Funding status unavailable.');});
}
function close(){const dialog=$('cw-starling-fund-dialog');if(dialog?.close)dialog.close();else if(dialog)dialog.hidden=true;}
function init(){
  if(location.origin!==ORIGIN)return;
  const trigger=$('cw-headquarters-funding-open');
  const dialog=$('cw-starling-fund-dialog');
  if(!trigger||!dialog)return;
  trigger.hidden=false;
  trigger.addEventListener('click',open);
  $('cw-starling-fund-close')?.addEventListener('click',close);
  $('cw-starling-fund-form')?.addEventListener('submit',submit);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  const choice=Array.from(document.querySelectorAll('input[name="cw-starling-fund-choice"]'));
  const custom=$('cw-starling-fund-custom');
  custom?.addEventListener('focus',()=>{const opt=choice.find(r=>r.value==='custom');if(opt)opt.checked=true;});
  if(new URLSearchParams(location.search).get('starlingFunding')==='return'){
    // A return URL is not a payment receipt and must never assert success.
    open();
    message('Returned from checkout. Payment is counted after verification by Stripe. Refresh to see updated backing.');
  }
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

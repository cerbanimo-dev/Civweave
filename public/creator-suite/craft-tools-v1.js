(()=>{
'use strict';
function start(){
  const catalog=globalThis.CivweaveCraftCatalogV1;
  const list=document.getElementById('craft-list');
  const summary=document.getElementById('craft-count');
  if(!catalog||!list||!summary)return;
  const filters=Array.from(document.querySelectorAll('[data-craft-filter]'));
  let selectedCategory='all';
  function draw(category='all'){
    selectedCategory=category;
    const registered=new Set(Object.keys(globalThis.CivweaveCreatorToolsV1?.capabilities?.()?.editors||{}));
    const entries=catalog.list(category);
    list.replaceChildren();
    summary.textContent=entries.length+' upstream projects; '+[...registered].filter(id=>catalog.get(id)).length+' locally connected with a selected file';
    for(const item of entries){
      const card=document.createElement('article');
      card.className='craft-card';
      const title=document.createElement('h2');title.textContent=item.name;
      const intro=document.createElement('p');intro.textContent=item.summary;
      const status=document.createElement('p');status.className='craft-status';
      status.textContent=(registered.has(item.id)?'Connected locally · selected file · ':'Not connected · upstream ')+(item.browser==='web'?'WebAssembly available':item.browser==='experimental'?'browser status requires validation':item.deployment||'desktop support');
      const formats=document.createElement('small');
      formats.textContent=item.formats?'Formats: '+item.formats:'Optional self-hosted service; not deployed';
      const link=document.createElement('a');
      link.href=item.repository;
      link.rel='noopener noreferrer';link.target='_blank';
      link.textContent='Upstream source and setup';
      card.append(title,intro,status,formats,link);list.append(card);
    }
    filters.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.craftFilter===category)));
  }
  filters.forEach(btn=>btn.addEventListener('click',()=>draw(btn.dataset.craftFilter)));
  window.addEventListener('civweave:craft-connection',()=>draw(selectedCategory));
  draw();
  // Quest deep links carry IDs only. Never read task content, automatically pick
  // private files, or trigger privileged processing from a URL.
  const requested=new URLSearchParams(location.search).get('tool');
  const panelId=({wordcraft:'wordcraft-panel',cadcraft:'cadcraft-panel'})[requested];
  if(panelId){
    const panel=document.getElementById(panelId);
    if(panel){
      panel.focus({preventScroll:true});
      panel.scrollIntoView({block:'start',behavior:'instant'});
    }
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

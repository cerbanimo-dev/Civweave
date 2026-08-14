(()=>{
'use strict';

const VERSION='japanese-mode-v1';
const LANGUAGE_KEY='civweave.language.v1';
const JAPANESE='ja';
const ENGLISH='en';
const BRAND_NAMES=Object.freeze({
  civweave:Object.freeze({kanji:'民織',katakana:'シヴウィーヴ',latin:'Civweave',romanization:'Shivu-wīvu'}),
  cerbanimo:Object.freeze({kanji:'神織',katakana:'セルバニモ',latin:'Cerbanimo',romanization:'Serubanimo'})
});

if(globalThis.CivweaveJapaneseModeV1?.version===VERSION)return;

const EXACT_TRANSLATIONS=new Map([
  ['LOCAL WORKING CAMPUS','ローカル・ワーキング・キャンパス'],
  ['Guided rails','ガイド'],
  ['Free roam','自由探索'],
  ['Settings','設定'],
  ['Diagnostics','診断'],
  ['Learn what the intention requires.','目的に必要なことを学ぶ。'],
  ['Turn the route into skilled work.','ルートを技能ある仕事へ。'],
  ['Find materials, services, and help.','材料・サービス・助けを探す。'],
  ['Store consent, roles, and review.','同意・役割・レビューを記録する。'],
  ['CENTRAL MIRROR','中央ミラー'],
  ['Wish → weave → realms','願い → 織る → 各領域'],
  ['Message Weaveling','ウィーヴリングにメッセージ'],
  ['Tell Weaveling your wish, ask a question, or revise the route.','願い、質問、またはルートの修正をウィーヴリングに伝えてください。'],
  ['Send','送信'],
  ['Local history · deterministic by default','ローカル履歴 · 既定は決定論モード'],
  ['Export','書き出し'],
  ['Your weave','あなたの織り'],
  ['Local draft','ローカル下書き'],
  ['Weave','織り'],
  ['Progress','進捗'],
  ['Library','ライブラリ'],
  ['Campus','キャンパス'],
  ['Review','レビュー'],
  ['Home','ホーム'],
  ['Back','戻る'],
  ['Close','閉じる'],
  ['Open','開く'],
  ['Save','保存'],
  ['Cancel','キャンセル'],
  ['Edit','編集'],
  ['Delete','削除'],
  ['Done','完了'],
  ['Next','次へ'],
  ['Previous','前へ'],
  ['Continue','続ける'],
  ['Start','開始'],
  ['Stop','停止'],
  ['Share','共有'],
  ['Search','検索'],
  ['Profile','プロフィール'],
  ['Skills','スキル'],
  ['Tasks','タスク'],
  ['Projects','プロジェクト'],
  ['Rewards','報酬'],
  ['Offline','オフライン'],
  ['Online','オンライン'],
  ['Available','利用可能'],
  ['Unavailable','利用不可'],
  ['Loading…','読み込み中…'],
  ['Loading...','読み込み中…'],
  ['WORKBENCH','ワークベンチ'],
  ['Learning Workbench','学習ワークベンチ'],
  ['Learning progress','学習の進捗'],
  ['WORKBENCH STARTUP','ワークベンチ起動'],
  ['Opening Living School','Living School を開いています'],
  ['Starting the learning state and renderer. AI models load only when a learning action actually needs them.','学習状態と表示機能を起動しています。AIモデルは、学習アクションで実際に必要になったときだけ読み込まれます。'],
  ['Startup stages','起動ステージ'],
  ['State engine','状態エンジン'],
  ['Curriculum renderer','カリキュラム表示'],
  ['Interaction controller','操作コントローラー'],
  ['Retry Living School','Living School を再試行'],
  ['Open Downloads','ダウンロードを開く'],
  ['Retry Working Campus','Working Campus を再試行']
]);

const SKIP_SELECTOR='script,style,noscript,textarea,input,select,option,pre,code,[contenteditable="true"],[data-cw-ja-skip],[data-cw-ja-brand],.conversation,[data-user-content]';
const observedDocuments=new WeakSet();
const boundFrames=new WeakSet();

function explicitLanguage(url=location.href){
  try{
    const parsed=new URL(url,location.href);
    const value=(parsed.searchParams.get('lang')||parsed.searchParams.get('locale')||'').toLowerCase();
    if(value==='ja'||value==='ja-jp'||parsed.searchParams.get('japanese')==='1')return JAPANESE;
    if(value==='en'||value==='en-us')return ENGLISH;
  }catch{}
  return'';
}
function storedLanguage(){
  try{return localStorage.getItem(LANGUAGE_KEY)||''}catch{return''}
}
function persistLanguage(language){
  try{localStorage.setItem(LANGUAGE_KEY,language)}catch{}
}
function language(){
  const explicit=explicitLanguage();
  if(explicit){persistLanguage(explicit);return explicit}
  return storedLanguage()||ENGLISH;
}
function isJapanese(){return language()===JAPANESE}
function replacePreservingWhitespace(value,next){
  const lead=String(value).match(/^\s*/)?.[0]||'';
  const tail=String(value).match(/\s*$/)?.[0]||'';
  return `${lead}${next}${tail}`;
}
function translateExact(value){
  const text=String(value??'');
  const trimmed=text.trim();
  if(!trimmed)return text;
  const exact=EXACT_TRANSLATIONS.get(trimmed);
  if(exact)return replacePreservingWhitespace(text,exact);
  if(trimmed==='Civweave')return text;
  if(trimmed==='Cerbanimo')return text;
  if(trimmed.includes('Cerbanimo'))return replacePreservingWhitespace(text,trimmed.replaceAll('Cerbanimo','神織（セルバニモ / Cerbanimo）'));
  return text;
}
function canTranslateTextNode(node){
  const parent=node?.parentElement;
  return Boolean(parent&&!parent.closest(SKIP_SELECTOR));
}
function translateTextNode(node){
  if(!isJapanese()||!canTranslateTextNode(node))return;
  const next=translateExact(node.nodeValue);
  if(next!==node.nodeValue)node.nodeValue=next;
}
function translateAttributes(element){
  if(!isJapanese()||!element?.getAttribute||element.closest?.(SKIP_SELECTOR))return;
  for(const attribute of ['aria-label','title','placeholder']){
    const value=element.getAttribute(attribute);
    if(!value)continue;
    const next=translateExact(value);
    if(next!==value)element.setAttribute(attribute,next);
  }
}
function ensureStyles(doc){
  if(doc.getElementById('cw-ja-mode-style'))return;
  const style=doc.createElement('style');
  style.id='cw-ja-mode-style';
  style.textContent=`
    .cw-ja-brand{display:inline-flex;align-items:baseline;gap:.38em;flex-wrap:wrap;margin-inline-start:.45em;vertical-align:middle;font-family:system-ui,-apple-system,"Yu Gothic UI","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;letter-spacing:.02em}
    .cw-ja-brand strong{font-size:1em;line-height:1;font-weight:850}.cw-ja-brand small{font-size:.68em;line-height:1;opacity:.82;font-weight:700;white-space:nowrap}
    .cw-ja-brand[data-cw-ja-name="cerbanimo"] strong{letter-spacing:.08em}
    .cw-ja-language-control{position:relative;z-index:4;display:inline-flex!important;align-items:center;justify-content:center;min-height:32px;padding:6px 9px!important;border:1px solid currentColor!important;border-radius:999px!important;background:color-mix(in srgb,currentColor 9%,transparent)!important;color:inherit!important;font:800 11px/1 system-ui,-apple-system,"Noto Sans JP",sans-serif!important;cursor:pointer!important;white-space:nowrap!important}
    [data-realm="cerbanimo"]>.cw-ja-brand{display:flex;justify-content:center;margin:.28rem 0 0}
    @media(max-width:560px){.cw-ja-brand{gap:.28em;margin-inline-start:.3em}.cw-ja-brand small{font-size:.62em}.cw-ja-language-control{min-height:30px;padding:5px 8px!important}}
  `;
  (doc.head||doc.documentElement).append(style);
}
function makeBrand(doc,name){
  const data=BRAND_NAMES[name];
  const span=doc.createElement('span');
  span.className='cw-ja-brand';
  span.dataset.cwJaBrand='';
  span.dataset.cwJaName=name;
  span.setAttribute('lang','ja');
  const kanji=doc.createElement('strong');kanji.textContent=data.kanji;
  const kana=doc.createElement('small');kana.textContent=data.katakana;
  span.append(kanji,kana);
  span.title=`${data.katakana} (${data.romanization}) · ${data.latin}`;
  return span;
}
function addBrandAfter(element,name){
  if(!element?.parentElement||element.parentElement.querySelector(`:scope > .cw-ja-brand[data-cw-ja-name="${name}"]`))return false;
  element.insertAdjacentElement('afterend',makeBrand(element.ownerDocument,name));
  return true;
}
function ensureBranding(doc){
  if(!isJapanese())return;
  const root=doc.documentElement;
  if(root)root.dataset.civweaveLanguage=JAPANESE;
  const civCandidates=[...doc.querySelectorAll('.brand-copy strong,#brand-home strong,[data-civweave-brand] strong')].filter(node=>node.textContent.trim()==='Civweave');
  civCandidates.forEach(node=>addBrandAfter(node,'civweave'));
  const cerbCandidates=[...doc.querySelectorAll('[data-realm="cerbanimo"] strong,h1,h2,h3,[data-civweave-system="cerbanimo"] strong,[data-civweave-system="cerbanimo"] .brand')].filter(node=>node.textContent.trim()==='Cerbanimo');
  cerbCandidates.forEach(node=>addBrandAfter(node,'cerbanimo'));
  doc.querySelectorAll('img').forEach(img=>{
    const haystack=`${img.getAttribute('alt')||''} ${img.getAttribute('src')||''}`.toLowerCase();
    if(!haystack.includes('cerbanimo'))return;
    const host=img.closest('header,.brand,[class*="brand"],[class*="logo"]')||img.parentElement;
    if(!host||host.querySelector(':scope > .cw-ja-brand[data-cw-ja-name="cerbanimo"]'))return;
    host.append(makeBrand(doc,'cerbanimo'));
  });
}
function ensureLanguageControl(doc){
  if(!isJapanese()||doc.querySelector('[data-cw-ja-language-control]'))return;
  const host=doc.getElementById('cwf104-head')||doc.querySelector('.top,header,[role="banner"]');
  if(!host)return;
  const button=doc.createElement('button');
  button.type='button';
  button.className='cw-ja-language-control';
  button.dataset.cwJaLanguageControl='';
  button.dataset.cwJaSkip='';
  button.textContent='EN';
  button.title='Switch to English';
  button.setAttribute('aria-label','Switch Civweave to English');
  button.addEventListener('click',()=>{
    persistLanguage(ENGLISH);
    const next=new URL(doc.defaultView?.location?.href||location.href,location.href);
    next.searchParams.set('lang','en');
    (doc.defaultView||window).location.replace(next.href);
  });
  host.append(button);
}
function translateTree(root){
  if(!isJapanese()||!root)return;
  if(root.nodeType===Node.TEXT_NODE){translateTextNode(root);return}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE&&root.matches?.(SKIP_SELECTOR))return;
  if(root.nodeType===Node.ELEMENT_NODE)translateAttributes(root);
  const doc=root.ownerDocument||root;
  const view=doc.defaultView||window;
  const walker=doc.createTreeWalker(root,view.NodeFilter.SHOW_TEXT|view.NodeFilter.SHOW_ELEMENT);
  let node;
  while((node=walker.nextNode())){
    if(node.nodeType===view.Node.TEXT_NODE)translateTextNode(node);
    else translateAttributes(node);
  }
}
function bindFrame(frame){
  if(!frame||boundFrames.has(frame))return;
  boundFrames.add(frame);
  const apply=()=>{try{if(frame.contentDocument)applyDocument(frame.contentDocument)}catch{}};
  frame.addEventListener('load',apply);
  apply();
}
function bindFrames(doc){doc.querySelectorAll('iframe').forEach(bindFrame)}
function applyDocument(doc=document){
  if(!doc?.documentElement||!isJapanese())return false;
  doc.documentElement.lang='ja';
  doc.documentElement.dataset.civweaveLanguage=JAPANESE;
  ensureStyles(doc);
  translateTree(doc.body||doc.documentElement);
  ensureBranding(doc);
  ensureLanguageControl(doc);
  bindFrames(doc);
  if(doc.title.includes('Cerbanimo')&&!doc.title.includes('神織'))doc.title=doc.title.replaceAll('Cerbanimo','神織 セルバニモ · Cerbanimo');
  if(!observedDocuments.has(doc)){
    observedDocuments.add(doc);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        record.addedNodes.forEach(node=>{
          if(node.nodeType===1&&node.matches?.('[data-cw-ja-brand],[data-cw-ja-language-control]'))return;
          translateTree(node);
          if(node.nodeType===1){if(node.matches?.('iframe'))bindFrame(node);node.querySelectorAll?.('iframe')?.forEach(bindFrame)}
        });
      }
      ensureBranding(doc);
      ensureLanguageControl(doc);
    });
    observer.observe(doc.documentElement,{childList:true,subtree:true});
  }
  return true;
}
function setLanguage(next){
  const normalized=String(next||'').toLowerCase().startsWith('ja')?JAPANESE:ENGLISH;
  persistLanguage(normalized);
  return normalized;
}
function attachFrame(frame){bindFrame(frame);return frame}

const selected=language();
if(selected===JAPANESE){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>applyDocument(document),{once:true});else applyDocument(document);
}

globalThis.CivweaveJapaneseModeV1=Object.freeze({version:VERSION,language:()=>language(),isJapanese,apply:applyDocument,attachFrame,setLanguage,names:BRAND_NAMES,languageKey:LANGUAGE_KEY});
try{dispatchEvent(new CustomEvent('civweave:japanese-mode-ready',{detail:{version:VERSION,language:selected,names:BRAND_NAMES}}))}catch{}
})();

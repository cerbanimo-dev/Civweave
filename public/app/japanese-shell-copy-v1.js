(()=>{
'use strict';

const VERSION='japanese-shell-copy-v4-guild-terminology';
const LANGUAGE_KEY='civweave.language.v1';
const supported=new Set(['/app/index.html','/app/index','/app/installed-entry-v146.html','/app/installed-entry-v146']);
if(globalThis.CivweaveJapaneseShellCopyV1?.version===VERSION)return;
function japanese(){
  try{
    const params=new URLSearchParams(location.search),explicit=(params.get('lang')||params.get('locale')||'').toLowerCase();
    if(explicit==='ja'||explicit==='ja-jp'||params.get('japanese')==='1'){localStorage.setItem(LANGUAGE_KEY,'ja');return true}
    if(explicit==='en'||explicit==='en-us'){localStorage.setItem(LANGUAGE_KEY,'en');return false}
    return localStorage.getItem(LANGUAGE_KEY)==='ja';
  }catch{return false}
}
if(!supported.has(location.pathname)||!japanese())return;

const translations=new Map([
  ['INSTALLER · UPDATER · RECOVERY','インストーラー · アップデーター · リカバリー'],
  ['Your doorway into Civweave','Civweave への入口'],
  ['One luminous shell for the four realms, built to travel lightly and grow with the device.','4つの領域をひとつにつなぐ、軽やかで端末とともに育つシェルです。'],
  ['Stewarded by','運営・保守'],
  ['Platform craft & continuity','プラットフォーム設計・継続運用'],
  ['LIGHTWEIGHT APP SHELL','軽量アプリシェル'],
  ['Install the shell. Launch Civweave from your device app launcher. Download offline files only when you choose.','シェルをインストールし、端末のアプリランチャーから Civweave を起動してください。オフライン用ファイルは必要なときだけダウンロードできます。'],
  ['The installer does no large background work on arrival. Install prepares the small PWA shell. The offline campus is a separate resumable code download, while large pictures, media, knowledge packs, and local AI models arrive on demand.','このページを開いただけでは大容量のバックグラウンド処理は行いません。インストールでは小さなPWAシェルだけを準備します。オフラインキャンパスは再開可能な別ダウンロードで、画像・メディア・知識パック・ローカルAIモデルは必要になったときだけ取得します。'],
  ['Install shell','シェルをインストール'],
  ['Small browser-native PWA shell.','小さなブラウザネイティブPWAシェル。'],
  ['Launch installed app','インストールしたアプリを起動'],
  ['Open Civweave from your device app launcher.','端末のアプリランチャーから Civweave を開きます。'],
  ['Go offline when useful','必要なときにオフラインへ'],
  ['Download the code-first campus separately.','コード中心のオフラインキャンパスは別途ダウンロードします。'],
  ['Offline campus','オフラインキャンパス'],
  ['not downloaded','未ダウンロード'],
  ['not started','未開始'],
  ['Download offline campus','オフラインキャンパスをダウンロード'],
  ['Install Civweave','Civweave をインストール'],
  ['Check release','リリースを確認'],
  ['Ready when you are. Nothing large downloads until you ask for it.','準備ができたらどうぞ。要求するまで大容量データはダウンロードされません。'],
  ['App shell','アプリシェル'],
  ['not prepared','未準備'],
  ['Shell files','シェルファイル'],
  ['starts on install','インストール時に開始'],
  ['Storage lanes','ストレージ構成'],
  ['OPTIONAL OFFLINE KNOWLEDGE','任意のオフライン知識'],
  ['Knowledge packs wait until you use this section.','知識パックはこのセクションを使うまで待機します。'],
  ['School catalogs, video-atlas tools, and open-media installers are no longer loaded during the first installer paint. Interact with this section when you actually want those offline libraries.','学校カタログ、動画アトラス、オープンメディアのインストーラーは初回表示では読み込みません。オフライン資料が必要なときにこのセクションを使ってください。'],
  ['Human worlds','人間の世界'],
  ['Making and measuring','つくる・測る'],
  ['All schools','すべての学校'],
  ['None','なし'],
  ['Tap this section to load the optional knowledge catalog.','このセクションをタップすると任意の知識カタログを読み込みます。'],
  ['Not loaded','未読込'],
  ['Load optional catalog first','まず任意カタログを読み込む'],
  ['Remove selected saved schools','選択した保存済み学校を削除'],
  ['Optional tools are dormant until this section is used.','任意ツールはこのセクションを使うまで休止しています。'],
  ['FAST FRONT DOOR','高速な入口'],
  ['No campus crawl before your first click','最初の操作までキャンパス全体を読み込みません'],
  ['LAZY VISUALS','必要時に画像を取得'],
  ['Pictures can arrive room by room','画像は部屋ごとに取得できます'],
  ['PORTABLE RECOVERY','持ち運べるリカバリー'],
  ['Carry the package another way','パッケージを別の方法で持ち運べます'],
  ['Installed campus','インストール済みキャンパス'],
  ['Opening Civweave…','Civweave を開いています…'],
  ['Starting from the local app shell.','ローカルのアプリシェルから起動しています。'],
  ['Startup recovery','起動リカバリー'],
  ['Open Working Campus safely','Working Campus を安全に開く'],
  ['Open recovery tools','リカバリーツールを開く'],
  ['Retry startup','起動を再試行'],
  ['Recovery never clears your saved work, downloaded models, knowledge packs, or local databases.','リカバリーで保存済みの作業、ダウンロード済みモデル、知識パック、ローカルデータベースが消えることはありません。'],
  ['Startup is taking longer than it should.','起動に通常より時間がかかっています。'],
  ['Civweave is still recoverable.','Civweave はリカバリーできます。'],
  ['A previous launch did not finish. Safe startup is available immediately.','前回の起動が完了しませんでした。安全な起動をすぐ利用できます。'],
  ['The normal launcher did not finish quickly enough. You can enter the campus without reinstalling.','通常のランチャーが時間内に完了しませんでした。再インストールせずにキャンパスへ入れます。'],
  ['Checking this release’s consent requirements…','このリリースの同意要件を確認しています…'],
  ['Reading the installed release…','インストール済みリリースを確認しています…'],
  ['Checking the installed app shell…','インストール済みアプリシェルを確認しています…'],
  ['The existing local shell is taking over startup.','既存のローカルシェルで起動を続けています。'],
  ['Opening the local campus…','ローカルキャンパスを開いています…'],
  ['Open Civweave','Civweave を開く'],
  ['Civweave installed','Civweave インストール済み'],
  ['Opening app install…','アプリのインストールを開いています…'],
  ['Reload to install','再読み込みしてインストール'],
  ['LOCAL GUILD','ローカル・ギルド'],
  ['GUILD','ギルド'],
  ['Checking this Guild…','このギルドを確認しています…'],
  ['Checking this Guild...','このギルドを確認しています…'],
  ['Join a Civweave Guild','民織のギルドに参加'],
  ['Guild login unlocks capacity-backed Cloudflare AI.','ギルドにログインすると、容量枠に基づく Cloudflare AI を利用できます。'],
  ['Checking status','状態を確認中'],
  ['Choose a Guild','ギルドを選ぶ'],
  ['Guild membership capacity','ギルドのメンバー枠'],
  ['Citizen slots','市民枠'],
  ['Citizen residency available on this host.','このギルドには市民枠があります。'],
  ['Patron slots','パトロン枠'],
  ['Additional Patron residency available on this host.','このギルドには追加のパトロン枠があります。'],
  ['Reading the Guild’s live capacity before you join.','参加前にギルドの現在の空き枠を確認しています。'],
  ['Find the nearest Guild with Citizen or Patron capacity. Your exact location is never sent; Civweave rounds it before searching.','市民枠またはパトロン枠の空きがある最寄りのギルドを探します。正確な位置情報は送信せず、民織が概略化してから検索します。'],
  ['Use this Guild','このギルドを使用'],
  ['Join & log in','参加してログイン'],
  ['Find an open Guild','空きのあるギルドを探す'],
  ['Guildkeeper tools','ギルドキーパー用ツール'],
  ['Refresh status','状態を更新'],
  ['This installer is being served by a local Civweave Guild. Guildkeeper controls stay local to this node.','このインストーラーはローカルの民織ギルドから配信されています。ギルドキーパーの操作はこのノード内に留まります。'],
  ['A Guild login is device-bound and stored locally. Joining never silently starts a Patron membership.','ギルドへのログインはこの端末に結び付けてローカル保存されます。参加しただけでパトロン・メンバーシップが勝手に始まることはありません。'],
  ['Nearest Guilds with open slots','空き枠のある最寄りのギルド'],
  ['Choose which capacity counts as open. Patron capacity still requires an active Civweave membership.','検索対象にする空き枠の種類を選んでください。パトロン枠の利用には有効な民織メンバーシップが必要です。'],
  ['Show slots','表示する枠'],
  ['Citizen or Patron','市民またはパトロン'],
  ['Citizen only','市民枠のみ'],
  ['Patron only','パトロン枠のみ'],
  ['Use my approximate location','おおよその位置情報を使う'],
  ['Location is requested only when you start a nearest-Guild search.','位置情報は最寄りギルドの検索を開始したときだけ要求されます。'],
  ['Find nearest open Guild','最寄りの空きギルドを探す'],
  ['Logged in to this Guild','このギルドにログイン済み'],
  ['Guild status unavailable','ギルドの状態を取得できません'],
  ['Find another Guild','別のギルドを探す'],
  ['Guild online · app unavailable','ギルドはオンライン · アプリは利用不可'],
  ['Local Civweave Guild','ローカル民織ギルド'],
  ['Civweave Guild','民織ギルド'],
  ['Finding nearby Guilds…','近くのギルドを探しています…'],
  ['Checking nearby Guild capacity…','近くのギルドの空き枠を確認しています…'],
  ['small shell · optional code-first campus · visuals and models on demand','小さなシェル · 任意のコード中心キャンパス · 画像とモデルは必要時に取得'],
  ['Saved schools survive app-shell cleanup and updates.','保存した学校はアプリシェルのクリーンアップや更新後も残ります。'],
  ['Manual and node install','手動およびノード・インストール'],
  ['The page paints first. Shell setup begins only when you install, check the release, or explicitly request the offline campus.','まずページを表示します。シェルの準備は、インストール、リリース確認、またはオフラインキャンパスを明示的に要求したときだけ始まります。'],
  ['Large visual assets and fonts no longer belong to offline-campus completion. Normal runtime caching keeps them as the device actually visits those spaces.','大容量の画像やフォントはオフラインキャンパス完了条件には含まれません。通常のランタイムキャッシュが、端末で実際に訪れた場所に応じて保持します。'],
  ['Mobile install kit','モバイル・インストールキット'],
  ['Pocket Campus seed','ポケット・キャンパスのシード'],
  ['Knowledge school catalog','知識学校カタログ'],
  ['Civweave platform and Cerbanimo stewardship','民織プラットフォームと神織のスチュワードシップ'],
  ['Stewarded by Cerbanimo','神織が運営・保守'],
  ['Civweave topology','民織トポロジー'],
  ['Offline campus download','オフラインキャンパスのダウンロード'],
  ['App shell state','アプリシェルの状態'],
  ['Knowledge school presets','知識学校プリセット']
]);
function translate(value){
  const text=String(value??''),trimmed=text.trim(),next=translations.get(trimmed);
  if(!next)return text;
  const lead=text.match(/^\s*/)?.[0]||'',tail=text.match(/\s*$/)?.[0]||'';
  return `${lead}${next}${tail}`;
}
function translateText(node){
  const parent=node?.parentElement;
  if(!parent||parent.closest('script,style,noscript,textarea,input,select,option,pre,code,[data-cw-ja-skip]'))return;
  const next=translate(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;
}
function translateElement(element){
  if(!element?.getAttribute)return;
  for(const name of ['aria-label','title','placeholder']){const value=element.getAttribute(name);if(!value)continue;const next=translate(value);if(next!==value)element.setAttribute(name,next)}
}
function translateTree(root=document.body){
  if(!root)return;
  const doc=root.ownerDocument||document,walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let node=walker.currentNode;
  while(node){if(node.nodeType===Node.TEXT_NODE)translateText(node);else translateElement(node);node=walker.nextNode()}
}
function stewardBrand(){
  const strong=document.querySelector('.cw-steward-copy strong');if(!strong)return;
  if(!strong.hasAttribute('data-cw-ja-skip'))strong.dataset.cwJaSkip='';
  if(strong.textContent!=='Cerbanimo')strong.textContent='Cerbanimo';
  let jp=strong.parentElement?.querySelector('[data-cw-shell-cerbanimo-ja]');
  if(!jp){jp=document.createElement('span');jp.dataset.cwShellCerbanimoJa='';jp.dataset.cwJaSkip='';jp.lang='ja';jp.textContent='神織 · セルバニモ';jp.style.cssText='display:block;margin-top:2px;font-size:.86em;font-weight:850;letter-spacing:.04em';strong.insertAdjacentElement('afterend',jp)}
}
function apply(){
  document.documentElement.lang='ja';document.documentElement.dataset.civweaveLanguage='ja';
  translateTree(document.body||document.documentElement);stewardBrand();
  if(location.pathname.startsWith('/app/index'))document.title='民織 シヴウィーヴ · インストール';
  else if(location.pathname.startsWith('/app/installed-entry'))document.title='民織 シヴウィーヴ';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
const observer=new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='characterData'){translateText(record.target);continue}
    record.addedNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)translateText(node);else if(node.nodeType===Node.ELEMENT_NODE)translateTree(node)});
  }
  stewardBrand();
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
globalThis.CivweaveJapaneseShellCopyV1=Object.freeze({version:VERSION,apply,language:'ja',scope:'installer-and-installed-entry'});
})();
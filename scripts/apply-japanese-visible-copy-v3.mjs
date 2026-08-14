import { readFile, writeFile } from 'node:fs/promises';

const modePath = new URL('../public/app/japanese-mode-v1.js', import.meta.url);
const shellPath = new URL('../public/app/japanese-shell-copy-v1.js', import.meta.url);

const exact = [
  // Common controls and settings surfaced by the audit.
  ['About this app','このアプリについて'],
  ['Accept','承認'],
  ['Account','アカウント'],
  ['Account name','アカウント名'],
  ['Add','追加'],
  ['Allow','許可'],
  ['Allow once','今回のみ許可'],
  ['Always allow','常に許可'],
  ['Approve','承認'],
  ['Archive','アーカイブ'],
  ['Ask','質問する'],
  ['Choose','選ぶ'],
  ['Confirm','確認'],
  ['Connect','接続'],
  ['Copy','コピー'],
  ['Create','作成'],
  ['Decline','辞退'],
  ['Disable','無効化'],
  ['Dismiss','閉じる'],
  ['Email','メール'],
  ['Enable','有効化'],
  ['Expand','展開'],
  ['Filter','絞り込み'],
  ['Finish','完了'],
  ['Help','ヘルプ'],
  ['History','履歴'],
  ['Ignore','無視'],
  ['Invite','招待'],
  ['Join','参加'],
  ['Language','言語'],
  ['Less','少なく表示'],
  ['Login','ログイン'],
  ['Logout','ログアウト'],
  ['Member','メンバー'],
  ['Members','メンバー'],
  ['More','もっと見る'],
  ['Notifications','通知'],
  ['Owner','所有者'],
  ['Pause','一時停止'],
  ['Privacy','プライバシー'],
  ['Recovery','復旧'],
  ['Refresh','更新'],
  ['Reject','却下'],
  ['Reset','リセット'],
  ['Restore','復元'],
  ['Retry','再試行'],
  ['Security','セキュリティ'],
  ['Select','選択'],
  ['Status','状態'],
  ['Steward','スチュワード'],
  ['Submit','送信'],
  ['Sync','同期'],
  ['Update','更新'],
  ['Upload','アップロード'],
  ['Verify','確認'],
  ['Vote','投票'],

  // Hub installer, membership, and capacity.
  ['LOCAL HUB NODE','ローカル・ハブノード'],
  ['HUB NODE','ハブノード'],
  ['Checking this Hub Node…','このハブノードを確認しています…'],
  ['Checking this Hub Node...','このハブノードを確認しています…'],
  ['Join a Civweave Hub Node','民織のハブノードに参加'],
  ['Hub login unlocks capacity-backed Cloudflare AI.','ハブログインすると、容量枠に基づく Cloudflare AI を利用できます。'],
  ['Checking status','状態を確認中'],
  ['Choose a Hub','ハブを選ぶ'],
  ['Host Node membership capacity','ホストノードのメンバー枠'],
  ['Free slots','無料枠'],
  ['Community residency available on this host.','このホストにはコミュニティ向けの無料参加枠があります。'],
  ['Paid slots','有料枠'],
  ['Additional paid-expansion residency available.','追加の有料拡張参加枠があります。'],
  ['Reading the Hub’s live capacity before you join.','参加前にハブの現在の空き枠を確認しています。'],
  ['Find the nearest Hub with community or paid-expansion capacity. Your exact location is never sent; Civweave rounds it before searching.','無料または有料拡張の空きがある最寄りのハブを探します。正確な位置情報は送信せず、民織が概略化してから検索します。'],
  ['Use this Hub Node','このハブノードを使用'],
  ['Join & log in','参加してログイン'],
  ['Find an open Hub','空きのあるハブを探す'],
  ['Hub steward tools','ハブ・スチュワード用ツール'],
  ['Refresh status','状態を更新'],
  ['This installer is being served by a Civweave federated Hub Node. Steward controls stay local to this node.','このインストーラーは民織の連合ハブノードから配信されています。スチュワード操作はこのノード内に留まります。'],
  ['A Hub login is device-bound and stored locally. Joining never silently starts a paid membership.','ハブログインはこの端末に結び付けてローカル保存されます。参加しただけで有料メンバーシップが勝手に始まることはありません。'],
  ['Nearest Hubs with open slots','空き枠のある最寄りのハブ'],
  ['Choose which capacity counts as open. Paid-expansion access still requires an active Civweave membership.','検索対象にする空き枠の種類を選んでください。有料拡張枠の利用には有効な民織メンバーシップが必要です。'],
  ['Show slots','表示する枠'],
  ['Free or paid','無料または有料'],
  ['Free only','無料枠のみ'],
  ['Paid only','有料枠のみ'],
  ['Use my approximate location','おおよその位置情報を使う'],
  ['Location is requested only when you start a nearest-Hub search.','位置情報は最寄りハブの検索を開始したときだけ要求されます。'],
  ['Membership','メンバーシップ'],
  ['Member · $5/month','メンバー · 月額 $5'],
  ['Maker · $10/month','メーカー · 月額 $10'],
  ['Builder · $20/month','ビルダー · 月額 $20'],
  ['Steward · $40/month','スチュワード · 月額 $40'],
  ['Join this Hub','このハブに参加'],
  ['This Hub has paid-expansion room but no free community seats. Checkout does not consume a free seat.','このハブには有料拡張枠がありますが、無料コミュニティ枠は空いていません。チェックアウトで無料枠が消費されることはありません。'],
  ['Find a free Hub','無料枠のあるハブを探す'],
  ['Choose a Cloudflare Hub before starting membership checkout.','メンバーシップのチェックアウトを始める前に Cloudflare ハブを選んでください。'],
  ['Opening checkout…','チェックアウトを開いています…'],
  ['The Hub did not return a membership checkout URL.','ハブからメンバーシップ用チェックアウト URL が返されませんでした。'],
  ['That paid-expansion capacity just filled. Find another Hub or a free community slot.','その有料拡張枠はたった今満員になりました。別のハブか無料コミュニティ枠を探してください。'],
  ['Membership checkout was canceled. No paid seat was activated.','メンバーシップのチェックアウトはキャンセルされました。有料枠は有効になっていません。'],
  ['Membership confirmed. Finishing your Hub login…','メンバーシップを確認しました。ハブログインを完了しています…'],
  ['Membership active. You are logged in to this Hub.','メンバーシップは有効です。このハブにログインしました。'],

  // Passport, passkeys, account, and recovery.
  ['Account, Passports & recovery','アカウント、パスポート、復旧'],
  ['Your Civweave account uses an account name and Passport passkeys. An outside recovery email is optional.','民織アカウントはアカウント名とパスポートのパスキーを使います。外部の復旧用メールは任意です。'],
  ['setting up…','設定中…'],
  ['This is the name you see. Civweave manages internal mail routing behind it without presenting an email address as your identity.','これは表示されるアカウント名です。民織は内部のメール経路を裏側で管理し、メールアドレスをあなたの本人表示には使いません。'],
  ['Add this Passport passkey','このパスポートのパスキーを追加'],
  ['Optional recovery email','任意の復旧用メール'],
  ['Adding an email never changes your account name. If the address already belongs to an online Civweave account, email proof plus an existing account passkey is required before this Passport can be linked.','メールを追加してもアカウント名は変わりません。そのアドレスが既存のオンライン民織アカウントに属している場合、このパスポートを関連付けるにはメール確認と既存アカウントのパスキーが必要です。'],
  ['Send verification code','確認コードを送信'],
  ['6-digit code','6桁のコード'],
  ['Verify & continue','確認して続ける'],
  ['Sign in with an account name','アカウント名でサインイン'],
  ['Use passkey','パスキーを使用'],
  ['No email address is required to sign in.','サインインにメールアドレスは必要ありません。'],
  ['Legacy recovery code','従来の復旧コード'],
  ['Accounts created before Passport passkeys may still use a saved one-time Hub recovery code.','パスポートのパスキー導入前に作成されたアカウントでは、保存済みの使い切りハブ復旧コードを引き続き利用できます。'],
  ['Saved recovery code','保存済み復旧コード'],
  ['Recover legacy account','従来アカウントを復旧'],
  ['Add another passkey for this Passport','このパスポートに別のパスキーを追加'],
  ['Passport passkey ready','パスポートのパスキー準備完了'],
  ['Hub identity is not ready yet.','ハブの識別情報はまだ準備できていません。'],
  ['Join this Hub before setting up the account.','アカウントを設定する前にこのハブへ参加してください。'],
  ['Create or load a Passport first.','先にパスポートを作成するか読み込んでください。'],
  ['Passkey registration did not return a complete credential.','パスキー登録から完全な認証情報が返されませんでした。'],
  ['Passkey authentication did not return a complete assertion.','パスキー認証から完全な認証応答が返されませんでした。'],
  ['This device does not support passkeys.','この端末はパスキーに対応していません。'],
  ['Existing account location is unavailable.','既存アカウントの保存先を確認できません。'],
  ['Request a verification code first.','先に確認コードを要求してください。'],

  // Hub map and offline map controls.
  ['Civweave Hub Map','民織 ハブマップ'],
  ['Physical Hub nodes + signed locality ledger + offline gossip','物理ハブノード + 署名済み地域台帳 + オフライン・ゴシップ'],
  ['Hub Map','ハブマップ'],
  ['Find a Hub in place','その場所のハブを探す'],
  ['Browse steward-placed Civweave Hub nodes first. Join one, explore its most recent cached Needs, Offerings, and Ideas, or pass by through the mesh when distance is only virtual.','まずスチュワードが設置した民織ハブノードを見てください。参加して最新キャッシュの「必要」「提供」「アイデア」を探索したり、距離が仮想的な場合はメッシュ経由で立ち寄ったりできます。'],
  ['Hub nodes','ハブノード'],
  ['Offline map','オフライン地図'],
  ['Auto coverage on','自動カバレッジ：オン'],
  ['Keep maps','地図を保持'],
  ['Run map check','地図チェックを実行'],
  ['Basemap behavior','ベースマップの動作'],
  ['Auto · online when connected','自動 · 接続時はオンライン'],
  ['Online only','オンラインのみ'],
  ['Downloaded maps only','ダウンロード済み地図のみ'],
  ['Offline coverage is checking this view…','この表示範囲のオフライン対応状況を確認しています…'],
  ['Reading map storage…','地図ストレージを確認しています…'],
  ['No downloaded map regions yet.','ダウンロード済みの地図地域はまだありません。'],
  ['verified','検証済み'],
  ['unverified','未検証'],
  ['Pinned','固定済み'],
  ['Pin','固定'],
  ['Use','使用'],
  ['Auto coverage paused','自動カバレッジ：一時停止'],
  ['Storage managed by browser','ストレージはブラウザが管理'],
  ['Maps kept offline','地図をオフライン保持'],
  ['Browser may reclaim maps','ブラウザが地図データを自動削除する場合があります'],
  ['Storage permission unavailable','ストレージ保持権限を利用できません'],
  ['Checking…','確認中…'],
  ['Map v1 check passed · offline renderer, PMTiles, and storage are ready.','Map v1 チェック合格 · オフライン描画、PMTiles、ストレージを利用できます。'],

  // Node AI live payments.
  ['No HTTP origin advertised.','HTTP オリジンが公開されていません。'],
  ['This node does not advertise a live payment origin.','このノードはライブ決済用オリジンを公開していません。'],
  ['Pair with this node before adding live credit.','ライブクレジットを追加する前にこのノードとペアリングしてください。'],
  ['The node did not return a checkout URL.','ノードからチェックアウト URL が返されませんでした。'],
  ['Checking paired nodes for live payment readiness…','ペアリング済みノードのライブ決済対応状況を確認しています…'],
  ['Discover a Node AI service first. Live credit is offered only by nodes that explicitly enable it.','先に Node AI サービスを見つけてください。ライブクレジットは明示的に有効化したノードだけが提供します。'],
  ['Live-payment nodes are visible, but pair with one before paying it.','ライブ決済対応ノードは見つかりました。支払う前にいずれかとペアリングしてください。'],
  ['No discovered node currently advertises live payments. Sandbox trial credit remains separate.','見つかったノードの中に現在ライブ決済を公開しているものはありません。サンドボックスの試用クレジットは別扱いです。'],
  ['Pay this node for prepaid service credit. The node operator receives the charge through their connected payout account; Civweave applies the node’s declared platform fee.','このノードへ前払いサービスクレジットを支払います。ノード運営者は接続済みの受取口座で代金を受け取り、民織はノードが指定したプラットフォーム手数料を適用します。'],
  ['Live credit amount in dollars','ライブクレジット金額（ドル）'],
  ['Opening secure checkout…','安全なチェックアウトを開いています…'],

  // AI/model settings. Product/provider tokens intentionally remain recognizable.
  ['UNIVERSAL AI SETTINGS','共通AI設定'],
  ['Choose the Compass mind','コンパスの頭脳を選ぶ'],
  ['Route','ルート'],
  ['Onboard SmolLM2 360M','SmolLM2 360M を端末に搭載'],
  ['Google Gemini','Google Gemini'],
  ['Ollama or local API','Ollama またはローカル API'],
  ['OpenAI-compatible endpoint','OpenAI 互換エンドポイント'],
  ['Checking the local package…','ローカルパッケージを確認しています…'],
  ['Onboard model','端末搭載モデル'],
  ['Package manifest','パッケージ・マニフェスト'],
  ['Fallback expectation','フォールバック時の期待動作'],
  ['Useful within evidence, explicit about uncertainty, no invented network or tool activity, no claim that external actions occurred, and consent preserved.','根拠の範囲で役立ち、不確実性を明示し、存在しないネットワークやツール操作を捏造せず、外部操作を実行したと偽らず、同意を守ります。'],
  ['Check local package','ローカルパッケージを確認'],
  ['Run five-prompt trial','5プロンプト試験を実行'],
  ['The local package has not been checked yet.','ローカルパッケージはまだ確認されていません。'],
  ['Gemini API key','Gemini API キー'],
  ['Paste a Google Gemini API key','Google Gemini API キーを貼り付け'],
  ['Google API endpoint','Google API エンドポイント'],
  ['Allow prompts to leave this device for Google’s Gemini API.','Google の Gemini API を使うため、この端末からプロンプトを送信することを許可します。'],
  ['Use Antigravity for agentic and background work','エージェント処理とバックグラウンド作業に Antigravity を使う'],
  ['Standard conversation stays on Gemini. Longer tool-using work uses Antigravity. SmolLM2 remains the local fallback if both fail.','通常の会話は Gemini を使います。長時間のツール利用作業は Antigravity を使います。両方が失敗した場合は SmolLM2 がローカルのフォールバックになります。'],
  ['Agentic model','エージェント用モデル'],
  ['Antigravity may use managed code execution, Google Search, and URL Context through the shared runtime.','Antigravity は共有ランタイムを通じて、管理されたコード実行、Google Search、URL Context を使用する場合があります。'],
  ['Test Gemini connection','Gemini 接続をテスト'],
  ['No connection test has been run.','接続テストはまだ実行されていません。'],
  ['Test local model','ローカルモデルをテスト'],
  ['Bearer token or API key','Bearer トークンまたは API キー'],
  ['Optional session-only credential','任意のセッション限定認証情報'],
  ['Allow prompts to leave this device when the endpoint is remote.','エンドポイントがリモートの場合、この端末からプロンプトを送信することを許可します。'],
  ['Test endpoint','エンドポイントをテスト'],
  ['Provider preferences are stored locally. API keys remain in session storage and are excluded from exports and offline seeds.','プロバイダー設定はローカル保存されます。API キーはセッションストレージにのみ保持され、書き出しやオフラインシードには含まれません。'],
  ['Save settings','設定を保存'],

  // Legal consent and permission-facing copy.
  ['Before entering Civweave','民織に入る前に'],
  ['Read Terms of Service','利用規約を読む'],
  ['Privacy Policy','プライバシーポリシー'],
  ['Community Standards','コミュニティ基準'],
  ['Agree and continue','同意して続ける'],
  ['Acceptance could not be persisted on this device.','この端末に同意記録を保存できませんでした。'],
  ['Civweave could not save the required acceptance on this device. Storage must be available before continuing.','民織はこの端末に必要な同意記録を保存できませんでした。続行するにはストレージを利用できる必要があります。'],
  ['Legal release manifest is invalid.','法的リリースのマニフェストが無効です。'],
  ['Final legal enforcement is missing a Terms version or URL.','最終版の法的適用設定に利用規約のバージョンまたは URL がありません。'],
  ['Connected AI','接続AI'],
  ['Internet lookup','インターネット検索'],
  ['Camera','カメラ'],
  ['Microphone','マイク'],
  ['Nearby devices','近くのデバイス'],
  ['Location','位置情報'],
  ['Your device is asking permission…','端末が権限を求めています…'],
  ['Camera access is used only while the active tool is open.','カメラは現在のツールが開いている間だけ使用します。'],
  ['Microphone access is used only while the active tool is open.','マイクは現在のツールが開いている間だけ使用します。'],
  ['Nearby device access is used only for pairing and local transfer.','近くのデバイスへのアクセスはペアリングとローカル転送にだけ使用します。'],
  ['Location access is used only for the action you start. Civweave does not maintain background location history.','位置情報はあなたが開始した操作にだけ使用します。民織はバックグラウンドで位置履歴を保持しません。'],
  ['Notifications may appear after you grant browser or OS permission. Civweave does not subscribe you automatically.','ブラウザまたは OS の権限を許可した後に通知が表示される場合があります。民織が自動的に通知登録することはありません。'],
  ['Only the guide routes can request connected AI. Background pages cannot silently activate a remote provider.','接続AIを要求できるのはガイドのルートだけです。バックグラウンドページが無断でリモートプロバイダーを有効化することはできません。'],
  ['Go to Connection settings','接続設定へ'],
  ['Open S.A.F.E.','S.A.F.E. を開く'],
  ['Review request','リクエストを確認'],
  ['Provider','プロバイダー'],
  ['Sends off-device','端末外へ送信'],
  ['your current request + selected context','現在のリクエスト + 選択されたコンテキスト'],
  ['One-time internet lookup','今回のみのインターネット検索'],
  ['Cancel this request','このリクエストをキャンセル'],

  // Installer copy that was still English after Japanese v2.
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
];

const shellExact = [
  ...exact.filter(([key]) => [
    'LOCAL HUB NODE','HUB NODE','Checking this Hub Node…','Checking this Hub Node...','Join a Civweave Hub Node',
    'Hub login unlocks capacity-backed Cloudflare AI.','Checking status','Choose a Hub','Host Node membership capacity',
    'Free slots','Community residency available on this host.','Paid slots','Additional paid-expansion residency available.',
    'Reading the Hub’s live capacity before you join.','Find the nearest Hub with community or paid-expansion capacity. Your exact location is never sent; Civweave rounds it before searching.',
    'Use this Hub Node','Join & log in','Find an open Hub','Hub steward tools','Refresh status',
    'This installer is being served by a Civweave federated Hub Node. Steward controls stay local to this node.',
    'A Hub login is device-bound and stored locally. Joining never silently starts a paid membership.',
    'Nearest Hubs with open slots','Choose which capacity counts as open. Paid-expansion access still requires an active Civweave membership.',
    'Show slots','Free or paid','Free only','Paid only','Use my approximate location','Location is requested only when you start a nearest-Hub search.',
    'small shell · optional code-first campus · visuals and models on demand','Saved schools survive app-shell cleanup and updates.',
    'Manual and node install','The page paints first. Shell setup begins only when you install, check the release, or explicitly request the offline campus.',
    'Large visual assets and fonts no longer belong to offline-campus completion. Normal runtime caching keeps them as the device actually visits those spaces.',
    'Mobile install kit','Pocket Campus seed','Knowledge school catalog','Civweave platform and Cerbanimo stewardship',
    'Stewarded by Cerbanimo','Civweave topology','Offline campus download','App shell state','Knowledge school presets'
  ].includes(key))
];

const patterns = [
  `  [/^Add \\$([0-9]+(?:\\.[0-9]{1,2})?) live credit$/i,(_,amount)=>\`ライブクレジットを $\\{amount} 追加\`]`,
  `  [/^Could not start membership checkout: (.+)$/i,(_,reason)=>\`メンバーシップのチェックアウトを開始できませんでした: $\\{reason}\`]`,
  `  [/^Hub returned HTTP (\\d+)\\.?$/i,(_,status)=>\`ハブから HTTP $\\{status} が返されました。\`]`,
  `  [/^(\\d+) downloaded map regions?$/i,(_,count)=>\`ダウンロード済み地図地域: $\\{count}件\`]`,
  `  [/^(\\d+) free slots?$/i,(_,count)=>\`無料枠 $\\{count}\`]`,
  `  [/^(\\d+) paid slots?$/i,(_,count)=>\`有料枠 $\\{count}\`]`,
  `  [/^Map storage unavailable · (.+)$/i,(_,reason)=>\`地図ストレージを利用できません · $\\{reason}\`]`,
  `  [/^Map v1 check needs attention · (.+)$/i,(_,reason)=>\`Map v1 チェック要確認 · $\\{reason}\`]`,
  `  [/^Map v1 check failed · (.+)$/i,(_,reason)=>\`Map v1 チェック失敗 · $\\{reason}\`]`,
  `  [/^Live payments enabled(?: · (.+))?$/i,(_,detail)=>detail?\`ライブ決済有効 · $\\{detail}\`:'ライブ決済有効']`,
  `  [/^Opening checkout for (.+)…$/i,(_,name)=>\`$\\{name} のチェックアウトを開いています…\`]`,
  `  [/^(.+) runs on this device as a real onboard guide(?:\.| .*)$/i,(_,model)=>\`$\\{model} はこの端末上で実際のオンボードガイドとして動作します。\`]`
];

function existingKeys(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate map between ${startMarker} and ${endMarker}`);
  const body = source.slice(start, end);
  const keys = new Set();
  for (const line of body.split(/\r?\n/)) {
    const single = line.match(/^\s*\[\s*('(?:\\.|[^'])*')\s*,/);
    const double = line.match(/^\s*\[\s*("(?:\\.|[^"])*")\s*,/);
    const literal = single?.[1] || double?.[1];
    if (!literal) continue;
    try { keys.add(Function(`return ${literal}`)()); } catch {}
  }
  return keys;
}

function insertExact(source, additions, startMarker, endMarker) {
  const keys = existingKeys(source, startMarker, endMarker);
  const missing = additions.filter(([key]) => !keys.has(key));
  if (!missing.length) return source;
  const block = missing.map(([en,ja]) => `  [${JSON.stringify(en)},${JSON.stringify(ja)}]`).join(',\n');
  const marker = `\n]);\n\n${endMarker}`;
  if (!source.includes(marker)) throw new Error(`Could not find exact insertion marker for ${endMarker}`);
  return source.replace(marker, `,\n${block}\n]);\n\n${endMarker}`);
}

let mode = await readFile(modePath, 'utf8');
mode = mode.replace("const VERSION='japanese-mode-v2';", "const VERSION='japanese-mode-v3';");
mode = insertExact(mode, exact, 'const EXACT_TRANSLATIONS=new Map([', 'const STATIC_PHRASE_TRANSLATIONS');
const patternMarker = '\n]);\n\nconst SKIP_TEXT_SELECTOR';
if (!mode.includes("Add \\$([0-9]+(?:\\.[0-9]{1,2})?) live credit")) {
  if (!mode.includes(patternMarker)) throw new Error('Could not find pattern insertion marker');
  mode = mode.replace(patternMarker, `,\n${patterns.join(',\n')}\n]);\n\nconst SKIP_TEXT_SELECTOR`);
}
await writeFile(modePath, mode);

let shell = await readFile(shellPath, 'utf8');
shell = shell.replace("const VERSION='japanese-shell-copy-v1';", "const VERSION='japanese-shell-copy-v2';");
shell = insertExact(shell, shellExact, 'const translations=new Map([', 'function translate(value)');
await writeFile(shellPath, shell);

console.log(JSON.stringify({ok:true,revision:'japanese-visible-copy-v3',exactCandidates:exact.length,shellCandidates:shellExact.length,patterns:patterns.length},null,2));

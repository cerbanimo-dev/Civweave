(()=>{
'use strict';

const VERSION='japanese-mode-v2';
const LANGUAGE_KEY='civweave.language.v1';
const JAPANESE='ja';
const ENGLISH='en';
const BRAND_NAMES=Object.freeze({
  civweave:Object.freeze({kanji:'民織',katakana:'シヴウィーヴ',latin:'Civweave',romanization:'Shivu-wīvu'}),
  'living-school':Object.freeze({kanji:'生学舎',katakana:'リビング・スクール',latin:'Living School',romanization:'Seigakusha'}),
  cerbanimo:Object.freeze({kanji:'神織',katakana:'セルバニモ',latin:'Cerbanimo',romanization:'Serubanimo'}),
  fellowfare:Object.freeze({kanji:'共市',katakana:'フェローフェア',latin:'FellowFare',romanization:'Kyōichi'}),
  anarchadia:Object.freeze({kanji:'自治郷',katakana:'アナーケイディア',latin:'Anarchadia',romanization:'Jichikyō'})
});

if(globalThis.CivweaveJapaneseModeV1?.version===VERSION)return;

const EXACT_TRANSLATIONS=new Map([
  ['LOCAL WORKING CAMPUS','ローカル・ワーキング・キャンパス'],
  ['Guided rails','ガイド付きルート'],
  ['Free roam','自由探索'],
  ['Settings','設定'],
  ['Diagnostics','診断'],
  ['Learn what the intention requires.','目的に必要なことを学ぶ。'],
  ['Turn the route into skilled work.','ルートを技能ある仕事へ変える。'],
  ['Find materials, services, and help.','材料・サービス・助けを探す。'],
  ['Store consent, roles, and review.','同意・役割・レビューを記録する。'],
  ['CENTRAL MIRROR','中央ミラー'],
  ['Wish → weave → realms','願い → 織り → 各領域'],
  ['Message Weaveling','ウィーヴリングにメッセージ'],
  ['Tell Weaveling your wish, ask a question, or revise the route.','願いを伝えたり、質問したり、ルートを修正したりできます。'],
  ['Send','送信'],
  ['Sending…','送信中…'],
  ['Local history · deterministic by default','ローカル履歴 · 既定は決定論モード'],
  ['Local working memory · durable project memory','ローカル作業メモリ · 永続プロジェクトメモリ'],
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
  ['ready','準備完了'],
  ['review','レビュー待ち'],
  ['active','進行中'],
  ['completed','完了'],
  ['open','受付中'],
  ['closed','終了'],
  ['pending','保留中'],
  ['accepted','承認済み'],
  ['forming','募集中'],
  ['assembling','編成中'],
  ['in-progress','進行中'],
  ['in_progress','進行中'],
  ['Weaveling','ウィーヴリング'],
  ['Moss','モス'],
  ['Kamiya','カミヤ'],
  ['Rook','ルーク'],
  ['Merlin','マーリン'],
  ['You','あなた'],
  ['Dashboard','ダッシュボード'],
  ['Passport','パスポート'],
  ['Begin','始める'],
  ['Details','詳細'],
  ['Where','場所'],
  ['When','時期'],
  ['Type','種類'],
  ['Everything','すべて'],
  ['None','なし'],
  ['Gift','ギフト'],
  ['Barter','物々交換'],
  ['Buttons','ボタン'],
  ['Acorns','ドングリ'],

  ['What is your wish? Tell me what you want to make true. I will map the learning, skilled work, materials, and agreements it may require.','あなたの願いは？ 実現したいことを教えてください。必要になりそうな学び、技能ある仕事、材料、合意を一緒に地図にします。'],
  ['BEGIN WITH THE OUTCOME','望む結果から始める'],
  ['What is your wish?','あなたの願いは？'],
  ['I want to…','私は…したい'],
  ['Weave a route','ルートを織る'],
  ['The deterministic planner works immediately and stays local.','決定論プランナーはすぐに動作し、処理は端末内に留まります。'],
  ['APTITUDE AND LEARNING CHOICE','適性と学び方'],
  ['How should this route meet you?','このルートを、あなたにどう合わせますか？'],
  ['Current skill level','現在のスキルレベル'],
  ['New to most of it','ほとんど初めて'],
  ['Some practice','少し経験あり'],
  ['Comfortable','慣れている'],
  ['Expert, verify edges','熟練。境界だけ確認'],
  ['Learning mode','学習モード'],
  ['Practice while doing','実践しながら学ぶ'],
  ['Learn first, then build','先に学んでから作る'],
  ['Move into execution','すぐ実行へ進む'],
  ['Who is involved?','誰が関わりますか？'],
  ['Mostly me','主に自分'],
  ['Friends, team, or community','友人・チーム・コミュニティ'],
  ['Available rhythm','使える時間のリズム'],
  ['Important constraints','重要な制約'],
  ['Budget, accessibility, tools, deadlines, safety…','予算、アクセシビリティ、道具、期限、安全性…'],
  ['Revise wish','願いを修正'],
  ['Build reviewable weave','レビューできる織りを作る'],
  ['Building with local templates…','ローカルテンプレートで構築中…'],
  ['REVIEW GATE · NOT ACTIVE','レビューゲート · 未起動'],
  ['PASSPORT AND CONSENT','パスポートと同意'],
  ['Activate weave','織りを開始'],
  ['ROUTE COMPLETE','ルート完了'],
  ['ACTIVE WEAVE','進行中の織り'],
  ['LOCAL WEAVE LIBRARY','ローカル織りライブラリ'],
  ['Portable intentions','持ち運べる意図'],
  ['No saved weaves yet.','保存された織りはまだありません。'],
  ['Progress begins after a wish becomes a weave.','願いが織りになったら進捗が始まります。'],
  ['FIVE CONNECTED SYSTEMS','つながる5つのシステム'],
  ['Explore without losing the thread.','糸を見失わずに探索する。'],
  ['Each realm remains independently usable. Civweave carries the visible intention, model route, and reviewable handoffs you approve.','各領域は単独でも使えます。民織は、見える意図・モデルのルート・あなたが承認したレビュー可能な引き継ぎを持ち運びます。'],
  ['Tell me how much you want to learn, how you want to work, and what constraints matter.','どれくらい学びたいか、どう働きたいか、どんな制約が大切か教えてください。'],
  ['The weave is active. Follow the next rail or roam freely without losing the shared intention.','織りを開始しました。次のレールを進むことも、共有された意図を失わず自由に探索することもできます。'],
  ['Create a weave first.','まず織りを作ってください。'],
  ['Deterministic local','決定論ローカル'],
  ['Compatible API','互換API'],
  ['Hosted','ホスト型'],
  ['AI settings','AI設定'],
  ['Open Civweave settings','民織の設定を開く'],
  ['Civweave AI settings saved for every guide.','民織のAI設定をすべてのガイドに保存しました。'],
  ['Weaveling is reading working memory, durable project memory, and the selected AI route…','ウィーヴリングが作業メモリ、永続プロジェクトメモリ、選択されたAIルートを確認しています…'],
  ['Weaveling returned no text.','ウィーヴリングからテキストが返りませんでした。'],
  ['The call did not complete. Your message remains in local history.','処理は完了しませんでした。メッセージはローカル履歴に残っています。'],
  ['The planner stayed local and did not change model settings.','プランナーは端末内で動作し、モデル設定は変更していません。'],
  ['Deterministic templates are being ranked. MiniLM remains advisory and only runs when its local package is already available.','決定論テンプレートを順位付けしています。MiniLMは補助役に留まり、ローカルパッケージがすでに利用可能な場合だけ動作します。'],

  ['WORKBENCH','ワークベンチ'],
  ['Learning Workbench','学習ワークベンチ'],
  ['Learning progress','学習の進捗'],
  ['WORKBENCH STARTUP','ワークベンチ起動'],
  ['Opening Living School','生学舎を開いています'],
  ['Starting the learning state and renderer. AI models load only when a learning action actually needs them.','学習状態と表示機能を起動しています。AIモデルは、学習アクションで実際に必要になったときだけ読み込まれます。'],
  ['Startup stages','起動ステージ'],
  ['State engine','状態エンジン'],
  ['Curriculum renderer','カリキュラム表示'],
  ['Interaction controller','操作コントローラー'],
  ['Retry Living School','生学舎を再試行'],
  ['Open Downloads','ダウンロードを開く'],
  ['Retry Working Campus','ワーキング・キャンパスを再試行'],
  ['STARTUP RECOVERY','起動リカバリー'],
  ['Living School did not finish opening','生学舎の起動が完了しませんでした'],
  ['The surrounding Civweave shell is still running. Retry only the Living School workbench instead of reinstalling the app.','周囲の民織シェルは動作しています。アプリを再インストールせず、生学舎のワークベンチだけを再試行してください。'],
  ['Start New Topic','新しい学習テーマ'],
  ['Practice','練習'],
  ['Review Progress','進捗を確認'],
  ['Continue Learning','学習を続ける'],
  ['What would you like to learn today?','今日は何を学びたいですか？'],
  ['What do you want to learn?','何を学びたいですか？'],
  ['Learning path title','学習ルートのタイトル'],
  ['What capability should this unlock?','どんな能力を身につけたいですか？'],
  ['Curriculum title','カリキュラムのタイトル'],
  ['Observable learning objective','確認できる学習目標'],
  ['Sources and provenance','情報源と来歴'],
  ['Evidence and assessment policy','証拠と評価の方針'],
  ['Topic','テーマ'],
  ['Confidence','自信度'],
  ['What can you currently demonstrate?','今どんなことを実演できますか？'],
  ['Practicum title','実習タイトル'],
  ['Consequential work','実際につながる作業'],
  ['Milestones','マイルストーン'],
  ['Proof requirements','証明要件'],

  ['CERBANIMO // QUEST CONSOLE','神織 // クエスト・コンソール'],
  ['Plan. Build. Document. Deliver.','計画する。作る。記録する。届ける。'],
  ['New Quest','新しいクエスト'],
  ['Define an objective, milestones, proof, and reward.','目標、マイルストーン、証拠、報酬を定義する。'],
  ['Open Workboard','ワークボードを開く'],
  ['Manage active quests, checkpoints, and blockers.','進行中のクエスト、チェックポイント、障害を管理する。'],
  ['Project Workbench','プロジェクト作業台'],
  ['Edit project structure and implementation notes.','プロジェクト構造と実装メモを編集する。'],
  ['Proof Observatory','証拠観測所'],
  ['Validate evidence, review, appeal, and settle.','証拠、レビュー、異議申立て、決着を検証する。'],
  ['What needs to be built or completed?','何を作る、または完成させる必要がありますか？'],
  ['CONTINUE ACTIVE QUEST','進行中のクエストを続ける'],
  ['No active quest','進行中のクエストはありません'],
  ['Create a quest with a visible result, checkpoints, and validation.','見える成果、チェックポイント、検証を備えたクエストを作りましょう。'],
  ['Quest title','クエストのタイトル'],
  ['Visible result','見える成果'],
  ['Steps or checkpoints','手順またはチェックポイント'],
  ['Completion proof','完了の証拠'],
  ['Reward','報酬'],
  ['Task','タスク'],
  ['Owner','担当者'],
  ['Deadline','期限'],
  ['Acceptance criteria','受け入れ基準'],
  ['Quest or task','クエストまたはタスク'],
  ['Evidence','証拠'],
  ['Completion notes','完了メモ'],
  ['Submit for review','レビューに提出'],
  ['Need','必要なもの'],
  ['Quantity','数量'],
  ['Needed by','必要な期限'],
  ['Conditions','条件'],

  ['Offline ready · canonical rooms','オフライン対応 · 正規ルーム'],
  ['No active intention yet','進行中の意図はまだありません'],
  ['State a wish and turn it into a reviewable weave.','願いを述べ、レビューできる織りに変えましょう。'],
  ['The next learning path is waiting','次の学習ルートが待っています'],
  ['Continue the current topic, practice, then attach evidence.','現在のテーマを続け、練習し、証拠を添付しましょう。'],
  ['Start from a real task you want learning to unlock.','学びによってできるようになりたい実際の作業から始めましょう。'],
  ['Continue the next checkpoint and preserve proof.','次のチェックポイントへ進み、証拠を残しましょう。'],
  ['The exchange board is open','交換ボードが開いています'],
  ['Review matches, terms, logistics, and trust conditions.','候補、条件、受け渡し、信頼条件を確認しましょう。'],
  ['Post an offer or need with enough detail for a fair match.','公平にマッチできるだけの詳細を添えて、提供または必要なものを投稿しましょう。'],
  ['Saved records','保存済み記録'],
  ['Capabilities used','使用した機能'],
  ['This room is intentionally quiet. No canonical capability is assigned here yet.','この部屋は意図的に静かです。まだ正規機能は割り当てられていません。'],
  ['Model route','モデルルート'],
  ['Model name','モデル名'],
  ['Endpoint','エンドポイント'],
  ['Allow remote prompts','リモートプロンプトを許可'],
  ['Wish or intention','願いまたは意図'],
  ['Visible outcome','見える成果'],
  ['People and context','人と文脈'],
  ['Boundaries, time, safety, budget, and consent','境界、時間、安全、予算、同意'],
  ['Learning posture','学び方'],
  ['learn first','先に学ぶ'],
  ['practice while doing','実践しながら学ぶ'],
  ['already know','すでに理解している'],
  ['Traversal','進み方'],
  ['guided','ガイド付き'],
  ['just-in-time','必要なときだけ'],
  ['browse','閲覧'],
  ['creator','作成者'],

  ['FELLOWFARE // LIVE MARKET','共市 // ライブ・マーケット'],
  ["Rook's Marketplace",'ルークのマーケット'],
  ['Local-first · real records only','ローカル優先 · 実データのみ'],
  ['Market','マーケット'],
  ['Sell','出品'],
  ['Orders','注文'],
  ['Wallet','ウォレット'],
  ['FellowFare marketplace','共市マーケット'],
  ['FellowFare products, services, learning, tutoring, orders, wallet, and profile','共市の商品、サービス、学び、個別指導、注文、ウォレット、プロフィール'],
  ['Opening the live local marketplace…','ローカルのライブマーケットを開いています…'],
  ['Marketplace is loading directly into this page.','マーケットをこのページに直接読み込んでいます。'],
  ['Product','商品'],
  ['Service','サービス'],
  ['Learning module','学習モジュール'],
  ['Tutoring','個別指導'],
  ['Material / resource','材料 / 資源'],
  ['Need / request','必要 / リクエスト'],
  ['Collective','共同'],
  ['Untitled listing','無題の出品'],
  ['Untitled market draft','無題のマーケット下書き'],
  ['Terms not priced yet','価格条件はまだ未設定'],
  ['Listing','出品'],
  ['No description supplied.','説明はありません。'],
  ['Not specified','未指定'],
  ['Flexible / not specified','柔軟 / 未指定'],
  ['Close listing','出品を終了'],
  ['Closed','終了済み'],
  ['Start arrangement','取り決めを始める'],
  ['FELLOWFARE MARKET','共市マーケット'],
  ['The market that is actually here.','いま、ここにあるマーケット。'],
  ['Products, services, learning, tutoring, materials, needs, and collective work. Every card below comes from stored or explicitly shared data.','商品、サービス、学び、個別指導、材料、必要なもの、共同作業。以下のカードはすべて保存済み、または明示的に共有されたデータから作られています。'],
  ['List something','出品する'],
  ['active listings','受付中の出品'],
  ['offers','提供'],
  ['open requests','受付中のリクエスト'],
  ['recorded commerce receipts','記録済み取引レシート'],
  ['Search actual listings','実際の出品を検索'],
  ['Show closed','終了済みも表示'],
  ['Your canonical balances','あなたの正規残高'],
  ['Open wallet','ウォレットを開く'],
  ['Offer title','提供のタイトル'],
  ['What is offered','提供するもの'],
  ['Quantity or availability','数量または提供可能量'],
  ['Area','地域'],
  ['Fair terms','公平な条件'],
  ['Need title','必要なもののタイトル'],
  ['What is needed','必要なもの'],
  ['What can be offered or guaranteed','提供または保証できるもの'],
  ['Tool','道具'],
  ['Condition','状態'],
  ['Pickup','受け取り'],
  ['Return date','返却日'],
  ['Responsibility and repair terms','責任と修理条件'],
  ['Participants','参加者'],
  ['Contribution','貢献'],
  ['Compensation or reciprocity','報酬または相互扶助'],
  ['Timing and milestones','時期とマイルストーン'],

  ['ANARCHADIA','自治郷'],
  ['CITIZEN CONSOLE','市民コンソール'],
  ['ANARCHADIA // CITIZEN CONSOLE','自治郷 // 市民コンソール'],
  ['LOCAL NODE','ローカルノード'],
  ['VOTE!','投票！'],
  ['Expanded citizen Passport','拡張市民パスポート'],
  ['ACTIVE','有効'],
  ['ANARCHADIAN CITIZEN','自治郷の市民'],
  ['SYNC PASSPORT','パスポートを同期'],
  ['Reading canonical ledgers…','正規台帳を読み込み中…'],
  ['Citizen level and experience','市民レベルと経験値'],
  ['LEVEL','レベル'],
  ['PASSPORT DISPLAY RANK','パスポート表示ランク'],
  ['Anarchadian Citizen','自治郷の市民'],
  ['Passport reward balances','パスポート報酬残高'],
  ['SKILL XP','スキルXP'],
  ['ACORNS','ドングリ'],
  ['BUTTONS','ボタン'],
  ['COTOKENS','コトークン'],
  ['CAPABILITY MATRIX','能力マトリクス'],
  ['Skill constellation','スキル星座'],
  ['XP remains owned by its source ledger.','XPの所有元は、それを発行した台帳のままです。'],
  ['ACTIVE INTENTION MAP','進行中の意図マップ'],
  ['Weave paths','織りのルート'],
  ['NO ACTIVE WEAVE','進行中の織りなし'],
  ['CIVWEAVE STORY CHRONICLES','民織ストーリー年代記'],
  ['Chronicle trail','年代記の軌跡'],
  ['Derived from real progress.','実際の進捗から生成されます。'],
  ['RECENT VERIFIED EVENTS','最近の検証済みイベント'],
  ['Reward receipts','報酬レシート'],
  ['Newest canonical events first.','新しい正規イベントから表示します。'],
  ['CERBANIMO VESTED LABOR OWNERSHIP','神織の権利確定労働持分'],
  ['Cotoken stake','コトークン持分'],
  ['The Passport mirrors peer-validated Cotokens. Cerbanimo remains the authority that issues and records them.','パスポートはピア検証済みコトークンを反映します。発行と記録の権限は神織にあります。'],
  ['Share awaits a canonical network supply ledger.','正規ネットワーク供給台帳が整うと持分を表示できます。'],
  ['Canonical ledger map','正規台帳マップ'],
  ['Skill XP + Acorns','スキルXP + ドングリ'],
  ['Cotokens + labor proof','コトークン + 労働証明'],
  ['Buttons + settlement','ボタン + 決済'],
  ['Intentions + Chronicles','意図 + 年代記'],
  ['display only, never mints','表示のみ。発行はしません'],
  ['REFRESH','更新'],
  ['ALL RECEIPTS','すべてのレシート'],
  ['Citizen console modules','市民コンソール・モジュール'],
  ['OPEN PROPOSALS','公開中の提案'],
  ['Shape what’s next.','次に起こることを形づくる。'],
  ['VIEW LEDGER','台帳を見る'],
  ['See the receipts.','レシートを確認する。'],
  ['AUTOMATION','自動化'],
  ['Build under rails.','ガードレールの中で作る。'],
  ['OBSERVATORY','観測所'],
  ['Watch the horizon.','地平線を見守る。'],
  ['GOVERNED UPDATE','統治された更新'],
  ['Consent, ballots, and signed authorization.','同意、投票、署名済み承認。'],
  ['GOVERNANCE WORKBENCH','ガバナンス作業台'],
  ['Charter, safeguards, dissent, exchange, and readiness.','憲章、安全策、異議、交換、準備状況。'],
  ['Civic pulse','市民パルス'],
  ['CIVIC PULSE','市民パルス'],
  ['CITIZENS','市民'],
  ['PROPOSALS','提案'],
  ['PARTICIPATION','参加率'],
  ['IDLE','待機中'],
  ['MOMENTUM','勢い'],
  ['PROPOSAL COMMONS','提案コモンズ'],
  ['Open proposals','公開中の提案'],
  ['+ BUGFIX REQUEST','+ バグ修正リクエスト'],
  ['+ FEATURE REQUEST','+ 機能リクエスト'],
  ['OPEN HUB BALLOT','ハブ投票を開く'],
  ['PUBLIC RECEIPTS','公開レシート'],
  ['Ledger','台帳'],
  ['This local ledger records requests, rail checks, generated patches, preview installs, vote signals, explicit approvals, keep-or-revert decisions, and reversible device-local layout overrides. It does not claim identity, authority, or consensus.','このローカル台帳は、リクエスト、レール確認、生成パッチ、プレビュー導入、投票シグナル、明示的承認、保持または差し戻しの判断、端末内で元に戻せるレイアウト変更を記録します。本人性、権限、合意形成を勝手に主張するものではありません。'],
  ['ACCOUNTABLE AUTOMATION','説明責任のある自動化'],
  ['Change pipeline','変更パイプライン'],
  ['Low-risk layout commands can generate a live-page preview immediately. Keeping one stores a reversible override on this device together with a fallback copy of the server-provided element and placement. Broader changes still pass through review before generation.','低リスクのレイアウト指示はすぐにライブページのプレビューを生成できます。保持すると、サーバー提供の要素と配置の退避コピーとともに、この端末へ元に戻せる上書きを保存します。より広い変更は生成前にレビューを通ります。'],
  ['READINESS & RISK','準備状況とリスク'],
  ['Observatory','観測所'],
  ['CHANGE REQUEST','変更リクエスト'],
  ['Submit request','リクエストを提出'],
  ['Title','タイトル'],
  ['What should change?','何を変えるべきですか？'],
  ['Current problem','現在の問題'],
  ['What is happening now, and who is affected?','今何が起きていて、誰に影響がありますか？'],
  ['Expected result','期待する結果'],
  ['What should happen instead?','代わりにどうなるべきですか？'],
  ['Affected area','影響する領域'],
  ['Installer / PWA','インストーラー / PWA'],
  ['Model runtime','モデル実行環境'],
  ['One testable outcome per line','1行につき1つ、検証可能な結果'],
  ['Risk and consent notes','リスクと同意のメモ'],
  ['Data, permissions, cost, publishing, deletion, external messages, or people affected','データ、権限、費用、公開、削除、外部メッセージ、影響を受ける人'],
  ['Evidence or reproduction steps','証拠または再現手順'],
  ['Screenshots, logs, routes, inputs, or exact steps','スクリーンショット、ログ、ルート、入力、正確な手順'],
  ['Submission creates a reviewable request only. Code generation starts after you review and approve it. The generated preview then requires a separate Keep or Revert decision.','送信しても作られるのはレビュー可能なリクエストだけです。コード生成は、あなたが確認して承認した後に始まります。生成されたプレビューには、別途「保持」または「元に戻す」の判断が必要です。'],
  ['SEND TO REVIEW','レビューへ送る'],
  ['Chat with Merlin','マーリンとチャット'],
  ['ANARCHADIA GUIDE','自治郷ガイド'],
  ['Civic clarity, accountable automation, and reversible local interface changes.','市民のための明快さ、説明責任のある自動化、元に戻せるローカルUI変更。'],
  ['OPEN FULL GUIDE','フルガイドを開く'],
  ['Try: Move this chat window to the top of the page.','例: このチャットウィンドウをページ上部へ移動して。'],
  ['Local history · reversible layout requests generate live previews','ローカル履歴 · 元に戻せるレイアウト変更はライブプレビューを生成します'],
  ['★ Choose where to participate.','★ 参加する場所を選んでください。'],
  ['POWER TO THE PEOPLE. Ⓐ','力を人々へ。Ⓐ'],
  ['ISOLATED SANDBOX PREVIEW','隔離サンドボックス・プレビュー'],
  ['Preview','プレビュー'],
  ['Generated change preview','生成された変更プレビュー'],
  ['SEND SELECTED CANDIDATE TO VOTE','選択した候補を投票へ送る'],
  ['CLOSE','閉じる'],

  ['Language / 言語','言語 / Language'],
  ['Choose the interface language. This preference stays on this device and is used by the installed Civweave app.','表示言語を選んでください。この設定はこの端末に保存され、インストール済みの民織アプリでも使われます。'],
  ['Using English','英語を使用中'],
  ['Provider','プロバイダー'],
  ['Model','モデル'],
  ['API key','APIキー'],
  ['API Key','APIキー'],
  ['Test model','モデルをテスト'],
  ['Downloaded local AI','ダウンロード済みローカルAI'],
  ['Use locally','ローカルで使用'],
  ['Download','ダウンロード'],
  ['Remove','削除'],
  ['Recommended','推奨'],
  ['No measured run yet','計測済みの実行はまだありません'],
  ['ready','準備完了'],
  ['Lightweight fallback','軽量フォールバック'],
  ['Low-footprint CPU','低負荷CPU'],
  ['WebGPU ready','WebGPU 利用可能'],
  ['threaded WASM eligible','スレッドWASM対応']
]);

const STATIC_PHRASE_TRANSLATIONS=Object.freeze([
  ['Living School','生学舎'],
  ['LIVING SCHOOL','生学舎'],
  ['Cerbanimo','神織'],
  ['CERBANIMO','神織'],
  ['FellowFare','共市'],
  ['FELLOWFARE','共市'],
  ['Anarchadia','自治郷'],
  ['ANARCHADIA','自治郷'],
  ['Civweave','民織'],
  ['CIVWEAVE','民織'],
  ['Working Campus','ワーキング・キャンパス'],
  ['WORKING CAMPUS','ワーキング・キャンパス'],
  ['Passport','パスポート'],
  ['PASSPORT','パスポート'],
  ['Local ·','ローカル ·']
]);

const PATTERN_TRANSLATIONS=Object.freeze([
  [/^(\d+)\s+records$/i,(_,count)=>`${count}件の記録`],
  [/^(\d+)\s+total XP$/i,(_,count)=>`合計 ${count} XP`],
  [/^(\d+)\s+XP to level\s+(\d+)$/i,(_,xp,level)=>`レベル${level}まであと${xp} XP`],
  [/^(\d+)\s*\/\s*(\d+)\s+XP tier$/i,(_,current,total)=>`${current} / ${total} XP帯`],
  [/^(\d+)\s+vested$/i,(_,count)=>`権利確定 ${count}`],
  [/^(\d+)\s+OF\s+(\d+)\s+CHECKPOINTS$/i,(_,done,total)=>`${done} / ${total} チェックポイント`],
  [/^Next rail · (.+)$/i,(_,realm)=>`次のレール · ${translateStaticPhrases(realm)}`],
  [/^(.+)\s+selected for interactive chat\.$/i,(_,model)=>`${model} を対話チャット用に選択しました。`],
  [/^(\d+)\s+durable memories · (.+)$/i,(_,count,route)=>`永続メモリ ${count}件 · ${route}`]
]);

const SKIP_TEXT_SELECTOR='script,style,noscript,textarea,input,pre,code,[contenteditable="true"],[data-cw-ja-skip],[data-user-content],.message.user';
const SKIP_ELEMENT_SELECTOR='script,style,noscript,pre,code,[contenteditable="true"],[data-cw-ja-skip],[data-user-content],.message.user';
const observedDocuments=new WeakSet();
const boundFrames=new WeakSet();
const observerBrandingQueued=new WeakSet();

function explicitLanguage(url=location.href){
  try{
    const parsed=new URL(url,location.href);
    const value=(parsed.searchParams.get('lang')||parsed.searchParams.get('locale')||'').toLowerCase();
    if(value==='ja'||value==='ja-jp'||parsed.searchParams.get('japanese')==='1')return JAPANESE;
    if(value==='en'||value==='en-us')return ENGLISH;
  }catch{}
  return'';
}
function storedLanguage(){try{return localStorage.getItem(LANGUAGE_KEY)||''}catch{return''}}
function persistLanguage(language){try{localStorage.setItem(LANGUAGE_KEY,language)}catch{}}
function language(){const explicit=explicitLanguage();if(explicit){persistLanguage(explicit);return explicit}return storedLanguage()||ENGLISH}
function isJapanese(){return language()===JAPANESE}
function replacePreservingWhitespace(value,next){const lead=String(value).match(/^\s*/)?.[0]||'',tail=String(value).match(/\s*$/)?.[0]||'';return `${lead}${next}${tail}`}
function realmReference(name){const data=BRAND_NAMES[name];return data?`${data.kanji}（${data.katakana} / ${data.latin}）`:name}
function translateStaticPhrases(value){let text=String(value??'');for(const [from,to] of STATIC_PHRASE_TRANSLATIONS)text=text.replaceAll(from,to);return text}
function translatePatterns(trimmed){for(const [pattern,replacer] of PATTERN_TRANSLATIONS){pattern.lastIndex=0;if(pattern.test(trimmed)){pattern.lastIndex=0;return trimmed.replace(pattern,replacer)}}return''}
function translateExactOnly(value){const text=String(value??''),trimmed=text.trim();if(!trimmed)return text;const exact=EXACT_TRANSLATIONS.get(trimmed);return exact?replacePreservingWhitespace(text,exact):text}
function translateStatic(value){
  const text=String(value??''),trimmed=text.trim();if(!trimmed)return text;
  const exact=EXACT_TRANSLATIONS.get(trimmed);if(exact)return replacePreservingWhitespace(text,exact);
  if(trimmed==='Civweave')return replacePreservingWhitespace(text,realmReference('civweave'));
  if(trimmed==='Living School')return replacePreservingWhitespace(text,realmReference('living-school'));
  if(trimmed==='Cerbanimo')return replacePreservingWhitespace(text,realmReference('cerbanimo'));
  if(trimmed==='FellowFare')return replacePreservingWhitespace(text,realmReference('fellowfare'));
  if(trimmed==='Anarchadia')return replacePreservingWhitespace(text,realmReference('anarchadia'));
  const pattern=translatePatterns(trimmed);if(pattern)return replacePreservingWhitespace(text,pattern);
  const phrases=translateStaticPhrases(trimmed);return phrases!==trimmed?replacePreservingWhitespace(text,phrases):text;
}
function canTranslateTextNode(node){const parent=node?.parentElement;return Boolean(parent&&!parent.closest(SKIP_TEXT_SELECTOR))}
function brandNameForText(value){const normalized=String(value||'').trim().toLowerCase();return Object.keys(BRAND_NAMES).find(name=>BRAND_NAMES[name].latin.toLowerCase()===normalized)||''}
function preservesLatinRealmBrand(node){
  const parent=node?.parentElement,name=brandNameForText(node?.nodeValue);if(!parent||!name)return false;
  if(parent.matches?.(`[data-realm="${name}"] strong`))return true;
  return Boolean(parent.closest?.(`[data-civweave-system="${name}"] [data-civweave-brand],`+`[data-civweave-system="${name}"] [class*="brand"],`+`[data-civweave-system="${name}"] [class*="logo"],`+`[data-civweave-system="${name}"] .ac-console-id`));
}
function translateTextNode(node){
  if(!isJapanese()||!canTranslateTextNode(node)||preservesLatinRealmBrand(node))return;
  const parent=node.parentElement,inGuideConversation=Boolean(parent?.closest('.conversation,.ac-merlin-log,[data-chat-log]'));
  const next=inGuideConversation?translateExactOnly(node.nodeValue):translateStatic(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;
}
function translateAttributes(element){
  if(!isJapanese()||!element?.getAttribute||element.closest?.(SKIP_ELEMENT_SELECTOR))return;
  for(const attribute of ['aria-label','title','placeholder']){const value=element.getAttribute(attribute);if(!value)continue;const next=translateStatic(value);if(next!==value)element.setAttribute(attribute,next)}
}
function ensureStyles(doc){
  if(doc.getElementById('cw-ja-mode-style'))return;
  const style=doc.createElement('style');style.id='cw-ja-mode-style';style.textContent=`
    .cw-ja-brand{display:inline-flex;align-items:baseline;gap:.38em;flex-wrap:wrap;margin-inline-start:.45em;vertical-align:middle;font-family:system-ui,-apple-system,"Yu Gothic UI","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;letter-spacing:.02em}
    .cw-ja-brand strong{font-size:1em;line-height:1;font-weight:850}.cw-ja-brand small{font-size:.68em;line-height:1;opacity:.82;font-weight:700;white-space:nowrap}
    .cw-ja-brand[data-cw-ja-name="cerbanimo"] strong,.cw-ja-brand[data-cw-ja-name="living-school"] strong,.cw-ja-brand[data-cw-ja-name="fellowfare"] strong,.cw-ja-brand[data-cw-ja-name="anarchadia"] strong{letter-spacing:.08em}
    .cw-ja-language-control{position:relative;z-index:4;display:inline-flex!important;align-items:center;justify-content:center;min-height:32px;padding:6px 9px!important;border:1px solid currentColor!important;border-radius:999px!important;background:color-mix(in srgb,currentColor 9%,transparent)!important;color:inherit!important;font:800 11px/1 system-ui,-apple-system,"Noto Sans JP",sans-serif!important;cursor:pointer!important;white-space:nowrap!important}
    [data-realm]>.cw-ja-brand{display:flex;justify-content:center;margin:.28rem 0 0}
    [data-civweave-system="living-school"] .lsc218-brand .cw-ja-brand,[data-civweave-system="fellowfare"] .ffc144-header .cw-ja-brand,[data-civweave-system="anarchadia"] .ac-console-id .cw-ja-brand{display:flex;margin:.2rem 0 0;gap:.3em}
    @media(max-width:560px){.cw-ja-brand{gap:.28em;margin-inline-start:.3em}.cw-ja-brand small{font-size:.62em}.cw-ja-language-control{min-height:30px;padding:5px 8px!important}}
  `;(doc.head||doc.documentElement).append(style);
}
function makeBrand(doc,name,{includeLatin=false}={}){
  const data=BRAND_NAMES[name],span=doc.createElement('span');span.className='cw-ja-brand';span.dataset.cwJaBrand='';span.dataset.cwJaName=name;span.setAttribute('lang','ja');
  const kanji=doc.createElement('strong');kanji.textContent=data.kanji;const kana=doc.createElement('small');kana.textContent=includeLatin?`${data.katakana} · ${data.latin}`:data.katakana;span.append(kanji,kana);span.title=`${data.katakana} (${data.romanization}) · ${data.latin}`;return span;
}
function addBrandAfter(element,name){if(!element?.parentElement||element.parentElement.querySelector(`:scope > .cw-ja-brand[data-cw-ja-name="${name}"]`))return false;element.insertAdjacentElement('afterend',makeBrand(element.ownerDocument,name));return true}
function appendStandaloneBrand(host,name){if(!host||host.querySelector?.(`:scope > .cw-ja-brand[data-cw-ja-name="${name}"]`))return false;host.append(makeBrand(host.ownerDocument,name,{includeLatin:true}));return true}
function textMatchesBrand(node,name){return String(node?.textContent||'').trim().toLowerCase()===BRAND_NAMES[name].latin.toLowerCase()}
function ensureBranding(doc){
  if(!isJapanese())return;const root=doc.documentElement;if(root)root.dataset.civweaveLanguage=JAPANESE;
  const civCandidates=[...doc.querySelectorAll('.brand-copy strong,#brand-home strong,[data-civweave-brand] strong')].filter(node=>textMatchesBrand(node,'civweave'));civCandidates.forEach(node=>addBrandAfter(node,'civweave'));
  for(const name of ['living-school','cerbanimo','fellowfare','anarchadia']){
    const selectors=[`[data-realm="${name}"] strong`,`[data-civweave-system="${name}"] .rc-brand b`,`[data-civweave-system="${name}"] .rc-brand strong`,`[data-civweave-system="${name}"] [data-civweave-brand] strong`,`[data-civweave-system="${name}"] [class*="brand"] strong`,`[data-civweave-system="${name}"] [class*="brand"] b`,`[data-civweave-system="${name}"] [class*="logo"] strong`,`[data-civweave-system="${name}"] [class*="logo"] b`];
    if(name==='anarchadia')selectors.push('[data-civweave-system="anarchadia"] .ac-console-id b');const candidates=[...doc.querySelectorAll(selectors.join(','))].filter(node=>textMatchesBrand(node,name));candidates.forEach(node=>addBrandAfter(node,name));
  }
  appendStandaloneBrand(doc.querySelector('[data-civweave-system="living-school"] .lsc218-brand>div'),'living-school');appendStandaloneBrand(doc.querySelector('[data-civweave-system="fellowfare"] .ffc144-header .rc-brand>div'),'fellowfare');appendStandaloneBrand(doc.querySelector('[data-civweave-system="anarchadia"] .ac-console-id'),'anarchadia');
  doc.querySelectorAll('img').forEach(img=>{const haystack=`${img.getAttribute('alt')||''} ${img.getAttribute('src')||''}`.toLowerCase(),name=Object.keys(BRAND_NAMES).find(candidate=>candidate!=='civweave'&&haystack.includes(candidate));if(!name)return;const host=img.closest('header,.brand,[class*="brand"],[class*="logo"]')||img.parentElement;if(!host||host.querySelector(`:scope > .cw-ja-brand[data-cw-ja-name="${name}"]`))return;host.append(makeBrand(doc,name,{includeLatin:true}))});
}
function ensureLanguageControl(doc){
  if(!isJapanese()||doc.querySelector('[data-cw-ja-language-control]'))return;const host=doc.getElementById('cwf104-head')||doc.querySelector('.top,.rc-top,.lsc218-header,.ac-console-bar,header,[role="banner"]');if(!host)return;
  const button=doc.createElement('button');button.type='button';button.className='cw-ja-language-control';button.dataset.cwJaLanguageControl='';button.dataset.cwJaSkip='';button.textContent='EN';button.title='英語に切り替える';button.setAttribute('aria-label','民織を英語に切り替える');
  button.addEventListener('click',()=>{persistLanguage(ENGLISH);const next=new URL(doc.defaultView?.location?.href||location.href,location.href);next.searchParams.set('lang','en');(doc.defaultView||window).location.replace(next.href)});host.append(button);
}
function translateTree(root){
  if(!isJapanese()||!root)return;if(root.nodeType===Node.TEXT_NODE){translateTextNode(root);return}if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;if(root.nodeType===Node.ELEMENT_NODE&&root.matches?.(SKIP_ELEMENT_SELECTOR))return;if(root.nodeType===Node.ELEMENT_NODE)translateAttributes(root);
  const doc=root.ownerDocument||root,view=doc.defaultView||window,walker=doc.createTreeWalker(root,view.NodeFilter.SHOW_TEXT|view.NodeFilter.SHOW_ELEMENT);let node;while((node=walker.nextNode())){if(node.nodeType===view.Node.TEXT_NODE)translateTextNode(node);else translateAttributes(node)}
}
function bindFrame(frame){if(!frame||boundFrames.has(frame))return;boundFrames.add(frame);const apply=()=>{try{if(frame.contentDocument)applyDocument(frame.contentDocument)}catch{}};frame.addEventListener('load',apply);apply()}
function bindFrames(doc){doc.querySelectorAll('iframe').forEach(bindFrame)}
function translateDocumentTitle(doc){if(!isJapanese())return;for(const data of Object.values(BRAND_NAMES)){if(doc.title.includes(data.latin)&&!doc.title.includes(data.kanji))doc.title=doc.title.replaceAll(data.latin,`${data.kanji} ${data.katakana} · ${data.latin}`)}}
function scheduleBranding(doc){if(observerBrandingQueued.has(doc))return;observerBrandingQueued.add(doc);queueMicrotask(()=>{observerBrandingQueued.delete(doc);ensureBranding(doc);ensureLanguageControl(doc);translateDocumentTitle(doc)})}
function applyDocument(doc=document){
  if(!doc?.documentElement||!isJapanese())return false;doc.documentElement.lang='ja';doc.documentElement.dataset.civweaveLanguage=JAPANESE;ensureStyles(doc);translateTree(doc.body||doc.documentElement);ensureBranding(doc);ensureLanguageControl(doc);bindFrames(doc);translateDocumentTitle(doc);
  if(!observedDocuments.has(doc)){
    observedDocuments.add(doc);const observer=new MutationObserver(records=>{let needsBranding=false;for(const record of records){if(record.type==='characterData'){translateTextNode(record.target);continue}if(record.addedNodes.length)needsBranding=true;record.addedNodes.forEach(node=>{if(node.nodeType===1&&node.matches?.('[data-cw-ja-brand],[data-cw-ja-language-control]'))return;translateTree(node);if(node.nodeType===1){if(node.matches?.('iframe'))bindFrame(node);node.querySelectorAll?.('iframe')?.forEach(bindFrame)}})}if(needsBranding)scheduleBranding(doc)});observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true});
  }return true;
}
function setLanguage(next){const normalized=String(next||'').toLowerCase().startsWith('ja')?JAPANESE:ENGLISH;persistLanguage(normalized);return normalized}
function attachFrame(frame){bindFrame(frame);return frame}

const selected=language();if(selected===JAPANESE){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>applyDocument(document),{once:true});else applyDocument(document)}

globalThis.CivweaveJapaneseModeV1=Object.freeze({version:VERSION,language:()=>language(),isJapanese,apply:applyDocument,attachFrame,setLanguage,names:BRAND_NAMES,languageKey:LANGUAGE_KEY,translationCount:EXACT_TRANSLATIONS.size,phraseCount:STATIC_PHRASE_TRANSLATIONS.length,patternCount:PATTERN_TRANSLATIONS.length});
try{dispatchEvent(new CustomEvent('civweave:japanese-mode-ready',{detail:{version:VERSION,language:selected,names:BRAND_NAMES,translationCount:EXACT_TRANSLATIONS.size}}))}catch{}
})();

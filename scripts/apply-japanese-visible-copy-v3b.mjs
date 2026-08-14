import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../public/app/japanese-mode-v1.js', import.meta.url);
let source = await readFile(path, 'utf8');

const exact = [
  ['Sign in or create an account from Civweave Settings.','民織の設定からサインインするか、アカウントを作成してください。'],
  ['Open the list','一覧を開く'],
  ['View on map','地図で見る'],
  ['Review and compare','確認して比較'],
  ['Assembly Network','集会ネットワーク'],
  ['Braid need','必要を編み込む'],
  ['Sensitive','配慮が必要'],
  ['Private','非公開'],
  ['Non-urgent','緊急ではない'],
  ['Report queue','通報待ち一覧'],
  ['Trust restore','信頼の回復'],
  ['Start local session','ローカルセッションを開始'],
  ['Offline','オフライン'],
  ['Loading moderation queue...','モデレーション待ち一覧を読み込み中…'],
  ['Load moderation','モデレーションを読み込む'],
  ['Report ID','通報ID'],
  ['Report unavailable.','通報を取得できません。'],
  ['Anonymous','匿名'],
  ['Community Audit','コミュニティ監査'],
  ['Global Edit','全体編集'],
  ['Civweave Non-Coercion','民織 非強制原則'],
  ['Rules cannot be changed directly from this browser runtime. Submit a change request for public review instead.','このブラウザ実行環境からルールを直接変更することはできません。代わりに公開レビュー用の変更リクエストを提出してください。'],
  ['Open Anarchadia change request','自治郷の変更リクエストを開く'],
  ['Submission could not be prepared automatically.','送信内容を自動準備できませんでした。'],
  ['Validated Verdicts','検証済み評決'],
  ['Earn 2 newly issued acorns when your verdict is validated by consensus or an audit.','評決が合意または監査で検証されると、新しく発行されるどんぐりを2個獲得できます。'],
  ['Tribunal juror quality improves selection frequency when verdicts stay aligned with peers and audits.','評決が他の陪審員や監査結果と整合するほど陪審員としての信頼度が高まり、今後選ばれやすくなります。'],
  ['Pick Tribunal','法廷を選ぶ'],
  ['Tribunal Room','法廷'],
  ['Tribunal cases will appear here.','法廷案件はここに表示されます。'],
  ['Verdict','評決'],
  ['Liable','責任あり'],
  ['Dismiss claim','請求を棄却'],
  ['Abstain','棄権'],
  ['Explanation','説明'],
  ['Submit Verdict','評決を提出'],
  ['Tribunal has no active case.','この法廷には現在審理中の案件がありません。'],
  ['Tribunal verdict recorded.','評決を記録しました。'],
  ['Return to Anarchadia','自治郷へ戻る'],
  ['Return to Anarchadia?','自治郷へ戻りますか？'],
  ['Uncaught Error','未処理エラー'],
  ['Enter a recovery email first.','先に復旧用メールを入力してください。'],
  ['Sending a verification code…','確認コードを送信しています…'],
  ['Check that address for the next step.','そのメールアドレスを確認して次の手順へ進んでください。'],
  ['Enter the verification code.','確認コードを入力してください。'],
  ['Verifying email ownership…','メールの所有確認をしています…'],
  ['Recovery email verified and attached to this account.','復旧用メールを確認し、このアカウントに追加しました。'],
  ['Enter the account name first.','先にアカウント名を入力してください。'],
  ['Confirm the account passkey on this device…','この端末でアカウントのパスキーを確認してください…'],
  ['Enter a saved recovery code.','保存済みの復旧コードを入力してください。'],
  ['Checking saved recovery code…','保存済みの復旧コードを確認しています…'],
  ['Legacy Hub access recovered. Add a Passport passkey now so future sign-in does not depend on email.','従来のハブアクセスを復旧しました。今後メールに依存せずサインインできるよう、パスポートのパスキーを追加してください。'],
  ['Waiting for this device to create a passkey…','この端末でパスキーが作成されるのを待っています…'],
  ['Legal release manifest returned an invalid document.','法的リリースのマニフェストから無効な文書が返されました。'],
  ['Terms acceptance is required before continuing.','続行するには利用規約への同意が必要です。']
];

const patterns = [
  [`/^Verdict failed: (.+)$/i`, `(_,reason)=>\`評決を送信できませんでした: \${reason}\``],
  [`/^Account (.+) is ready on this Passport\.$/i`, `(_,name)=>\`アカウント \${name} をこのパスポートで利用できます。\``],
  [`/^Account (.+) is ready\. Add a passkey to give this Passport sign-in privileges\.$/i`, `(_,name)=>\`アカウント \${name} の準備ができました。このパスポートでサインインできるよう、パスキーを追加してください。\``],
  [`/^Account setup could not finish: (.+)$/i`, `(_,reason)=>\`アカウント設定を完了できませんでした: \${reason}\``],
  [`/^Passport passkey ready for (.+)\.$/i`, `(_,name)=>\`\${name} のパスポート用パスキーを利用できます。\``],
  [`/^Passport linked to existing account (.+) with email proof \+ an existing passkey\.$/i`, `(_,name)=>\`メール確認と既存のパスキーを使って、パスポートを既存アカウント \${name} に関連付けました。\``],
  [`/^Signed in to (.+) with a Passport passkey\.$/i`, `(_,name)=>\`パスポートのパスキーで \${name} にサインインしました。\``],
  [`/^Account security could not load: (.+)$/i`, `(_,reason)=>\`アカウントのセキュリティ情報を読み込めませんでした: \${reason}\``],
  [`/^Legal release manifest returned HTTP (\\d+)\.$/i`, `(_,status)=>\`法的リリースのマニフェストから HTTP \${status} が返されました。\``]
];

function insertExact(text) {
  const start=text.indexOf('const EXACT_TRANSLATIONS=new Map([');
  if(start<0)throw new Error('EXACT_TRANSLATIONS not found');
  const close=text.indexOf('\n]);',start);
  if(close<0)throw new Error('EXACT_TRANSLATIONS close not found');
  const missing=exact.filter(([en])=>!text.includes(`[${JSON.stringify(en)},`)&&!text.includes(`['${en.replaceAll("'","\\'")}',`));
  if(!missing.length)return text;
  const block=missing.map(([en,ja])=>`  [${JSON.stringify(en)},${JSON.stringify(ja)}]`).join(',\n');
  return text.slice(0,close)+`,\n${block}`+text.slice(close);
}

function insertPatterns(text) {
  const start=text.indexOf('const PATTERN_TRANSLATIONS=Object.freeze([');
  if(start<0)throw new Error('PATTERN_TRANSLATIONS not found');
  const close=text.indexOf('\n]);',start);
  if(close<0)throw new Error('PATTERN_TRANSLATIONS close not found');
  const missing=patterns.filter(([regex])=>!text.includes(regex.slice(1,-1)));
  if(!missing.length)return text;
  const block=missing.map(([regex,fn])=>`  [${regex},${fn}]`).join(',\n');
  return text.slice(0,close)+`,\n${block}`+text.slice(close);
}

source=insertExact(source);
source=insertPatterns(source);
await writeFile(path,source);
console.log(JSON.stringify({ok:true,revision:'japanese-visible-copy-v3b',exact:exact.length,patterns:patterns.length},null,2));

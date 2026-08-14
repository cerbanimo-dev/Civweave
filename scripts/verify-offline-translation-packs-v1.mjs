import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const [packs,worker,loader,repair,japanese]=await Promise.all([
 read('public/app/local-ai/translation-packs-v1.js'),read('public/app/local-ai/translation-worker-v1.js'),read('public/app/shared-guide-surface-v236.js'),read('public/service-worker-chat-repair-v245.js'),read('public/app/japanese-mode-v1.js')
]);
new Function(packs);new Function(worker);new Function(loader);new Function(repair);
const checks=[],check=(name,value)=>{assert.ok(value,name);checks.push(name)};
check('English to Japanese pack is pinned',packs.includes("repo:'Xenova/opus-mt-en-jap'")&&packs.includes("revision:'9d418190be3aa945eae5bab1bd96bc5e349ad784'"));
check('Japanese to English pack is pinned',packs.includes("repo:'Xenova/opus-mt-ja-en'")&&packs.includes("revision:'1a906cfaaf7c8f4193f67f5885c082aa6dbd9d16'"));
check('q8 encoder and merged decoder artifacts are downloaded',packs.includes("onnx/encoder_model_quantized.onnx")&&packs.includes("onnx/decoder_model_merged_quantized.onnx"));
check('weights stay upstream hosted',packs.includes('https://huggingface.co/${x.repo}/resolve/')&&packs.includes('upstreamHosted:true'));
check('language tools are not a chat model',packs.includes('chatModelSelectable:false')&&packs.includes('<h3>Language tools</h3>'));
check('existing Civweave language preference is reused',packs.includes("LANGUAGE_KEY='civweave.language.v1'")&&japanese.includes("LANGUAGE_KEY='civweave.language.v1'"));
check('detector covers Japanese script and Latin text without another model',packs.includes('detectLanguage')&&packs.includes('\\u3040-\\u30ff')&&packs.includes('[A-Za-z]'));
check('translation happens after decryption and preserves persistent privacy',packs.includes("privacyBoundary:'after-decryption-on-recipient-device'")&&packs.includes("translationCache:'memory-only'"));
check('group chat and PM receive translation hooks',packs.includes('.cwparty-message.is-human[data-party-message]')&&packs.includes("'civweave:private-message'")&&packs.includes("'civweave:private-message-translated'"));
check('worker is offline-only after pack installation',worker.includes('hf.env.allowRemoteModels=false')&&worker.includes('hf.env.useCustomCache=true')&&worker.includes("const TRANSFORMERS='/app/vendor/transformers/transformers.min.js'"));
check('worker explicitly selects q8 encoder and merged decoder',worker.includes("dtype:{encoder_model:'q8',decoder_model_merged:'q8'}"));
check('shared human chat loads translator runtime',loader.includes('/app/local-ai/translation-packs-v1.js')&&loader.includes("humanTranslation:'en-ja-local-v1'"));
check('offline repair packages translator and worker while keeping chat revision stable',repair.includes("const REVISION='chat-avatar-visible-v346'")&&repair.includes("TRANSLATION_PATH='/app/local-ai/translation-packs-v1.js'")&&repair.includes("TRANSLATION_WORKER_PATH='/app/local-ai/translation-worker-v1.js'")&&repair.includes('packageTranslation:cacheTranslationRuntime'));
console.log(JSON.stringify({ok:true,checks:checks.length,packs:2,languages:['en','ja'],modelWeights:'pinned Hugging Face resolve URLs',translation:'recipient-side after decryption',translationCache:'memory-only'},null,2));

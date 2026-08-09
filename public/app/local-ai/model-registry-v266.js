(()=>{
'use strict';
const VERSION='1.0.69-local-ai-registry-v274-inference-contracts';
if(globalThis.CivweaveLocalModelRegistryV266?.version===VERSION)return;
const HF='https://huggingface.co';
const SMOL_TEMPLATE_REVISION='a91ed44aac643515ffe38aae1e49c7213bb4ddc0';
const caps=value=>Object.freeze({interactive:true,structuredOutput:true,agenticReasoning:false,code:true,tools:false,externalResearch:false,vision:false,...value});
const gen=value=>Object.freeze({thinkingTemperature:.6,nonThinkingTemperature:.7,topK:20,...value});
const artifact=(path,minBytes,required,revision='')=>Object.freeze({path,minBytes,required,revision:revision||''});
const models=[
  {
    id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',tier:'Small',status:'stable',installable:true,recommended:'wide',
    provider:'huggingface',repo:'onnx-community/Qwen3-0.6B-ONNX',revision:'558750086ed49d78cb701ed6fa85af33fd16453f',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:610_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-0.6B',contextWindowTokens:40_960,workingContextTokens:4_096,healthTimeoutMs:360_000,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:false,code:true}),generation:gen(),
    artifacts:[
      artifact('config.json',500,true),artifact('tokenizer.json',1_000_000,true),artifact('tokenizer_config.json',500,true),
      artifact('generation_config.json',50,true),artifact('chat_template.jinja',100,false),artifact('onnx/model_q4f16.onnx',500_000_000,true)
    ]
  },
  {
    id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Standard',status:'stable',installable:true,recommended:'default',
    provider:'huggingface',repo:'onnx-community/Qwen3-1.7B-ONNX',revision:'e1da89f753284b95bd0971c64524f52edc5eb6e3',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:1_470_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-1.7B',contextWindowTokens:40_960,workingContextTokens:4_096,healthTimeoutMs:600_000,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),generation:gen(),
    artifacts:[
      artifact('config.json',500,true),artifact('tokenizer.json',1_000_000,true),artifact('tokenizer_config.json',500,true),
      artifact('generation_config.json',50,true),artifact('chat_template.jinja',100,false),artifact('onnx/model_q4f16.onnx',1_300_000_000,true)
    ]
  },
  {
    id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Enhanced',status:'stable',installable:true,recommended:'capable',
    provider:'huggingface',repo:'HuggingFaceTB/SmolLM3-3B-ONNX',revision:'161c5e4dbaf4167f022f9c4dbd283ffef5f7bc51',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:2_160_000_000,
    license:'Apache-2.0',sourceModel:'HuggingFaceTB/SmolLM3-3B',contextWindowTokens:65_536,workingContextTokens:2_048,healthTimeoutMs:900_000,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),generation:gen(),
    artifacts:[
      artifact('config.json',500,true),artifact('tokenizer.json',1_000_000,true),artifact('tokenizer_config.json',500,true,SMOL_TEMPLATE_REVISION),
      artifact('generation_config.json',50,true),artifact('chat_template.jinja',100,false,SMOL_TEMPLATE_REVISION),artifact('special_tokens_map.json',50,false),
      artifact('onnx/model_q4f16.onnx',100_000,true),artifact('onnx/model_q4f16.onnx_data',2_000_000_000,true)
    ]
  },
  {
    id:'qwen3.5-0.8b-q4f16',label:'Qwen 3.5 0.8B',tier:'Experimental',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/Qwen3.5-0.8B-ONNX',revision:'d85632356b5aec5ecf43ff506b282d6ece81611f',
    task:'image-text-to-text',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-next',estimatedBytes:560_000_000,
    license:'Apache-2.0',capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:false,code:true,vision:true}),
    reason:'Public ONNX/WebGPU artifacts exist, but the current Qwen3.5 browser instructions still target @huggingface/transformers@next. Civweave keeps this behind the preview gate until its pinned runtime and offline artifact manifest are verified together.'
  },
  {
    id:'qwen3.5-2b-q4f16',label:'Qwen 3.5 2B',tier:'Experimental',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/Qwen3.5-2B-ONNX-OPT',revision:'main',
    task:'image-text-to-text',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-next',estimatedBytes:1_400_000_000,
    license:'Apache-2.0',capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,vision:true}),
    reason:'Public browser ONNX builds exist, but the Qwen3.5 browser path is still documented against the Transformers.js @next channel. It remains preview-only until Civweave has a pinned, fully offline-tested multimodal manifest.'
  },
  {
    id:'gemma4-e2b-it-q4f16',label:'Gemma 4 E2B IT',tier:'Experimental',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/gemma-4-E2B-it-ONNX',revision:'main',
    task:'any-to-any',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v4',estimatedBytes:2_000_000_000,
    license:'Apache-2.0',capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,vision:true}),
    reason:'The public Transformers.js conversion is compatible with the current package family, but Gemma 4 is a multimodal multi-graph package with external data chunks. Civweave holds it behind preview until every required q4f16 graph is pinned, measured, and device-tested.'
  }
].map(model=>Object.freeze({...model,capabilities:model.capabilities||caps(),generation:model.generation||gen(),artifacts:Object.freeze(model.artifacts||[])}));
function byId(id){return models.find(model=>model.id===String(id||''))||null}
function artifactByPath(modelOrId,path){const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;if(!model)return null;const clean=String(path||'').replace(/^\/+/, '');return model.artifacts.find(item=>item.path===clean)||null}
function artifactRevision(modelOrId,path){const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;if(!model)return'';return artifactByPath(model,path)?.revision||model.revision}
function directUrl(modelOrId,pathOrArtifact){const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;if(!model)throw new Error('Unknown Civweave local model.');const item=typeof pathOrArtifact==='string'?{path:pathOrArtifact}:pathOrArtifact||{};const clean=String(item.path||'').replace(/^\/+/, '');const revision=item.revision||artifactRevision(model,clean)||model.revision;return `${HF}/${model.repo}/resolve/${encodeURIComponent(revision)}/${clean}`}
function installable(){return models.filter(model=>model.installable)}
function experimental(){return models.filter(model=>!model.installable)}
function capable(request={}){const broker=globalThis.CivweaveAICapabilityBrokerV268;return installable().filter(model=>broker?.supportsLocalRequest?.(model,request)?.ok)}
const api=Object.freeze({version:VERSION,host:HF,models:Object.freeze(models),byId,artifactByPath,artifactRevision,directUrl,installable,experimental,capable,smolTemplateRevision:SMOL_TEMPLATE_REVISION});
globalThis.CivweaveLocalModelRegistryV266=api;
dispatchEvent(new CustomEvent('civweave:local-model-registry-ready',{detail:{version:VERSION,count:models.length,installable:installable().length,capabilityAware:true,contextAware:true,artifactRevisionAware:true}}));
})();

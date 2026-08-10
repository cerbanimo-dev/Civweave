(()=> {
'use strict';
const VERSION='1.0.81-local-ai-registry-v278-hardware-ladder';
if(globalThis.CivweaveLocalModelRegistryV266?.version===VERSION)return;
const HF='https://huggingface.co';
const caps=value=>Object.freeze({interactive:true,structuredOutput:true,agenticReasoning:false,code:true,tools:false,externalResearch:false,vision:false,...value});
const freezeModel=model=>Object.freeze({...model,capabilities:model.capabilities||caps(),artifacts:model.artifacts?.map(([path,minBytes,required])=>Object.freeze({path,minBytes,required}))||[]});
const models=[
  {
    id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',tier:'Small',hardwareTier:'Phone Small',status:'stable',installable:true,recommended:'wide',
    provider:'huggingface',repo:'onnx-community/Qwen3-0.6B-ONNX',revision:'558750086ed49d78cb701ed6fa85af33fd16453f',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:610_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-0.6B',preferBackground:true,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:false,code:true}),
    artifacts:[
      ['config.json',500,true],['tokenizer.json',1_000_000,true],['tokenizer_config.json',500,true],
      ['generation_config.json',50,true],['chat_template.jinja',100,false],['onnx/model_q4f16.onnx',500_000_000,true]
    ]
  },
  {
    id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard',hardwareTier:'Phone Standard',status:'stable',installable:true,recommended:'default',
    provider:'huggingface',repo:'onnx-community/gemma-3-1b-it-ONNX',revision:'a7fa005d133fd9fc99e78b812f450742ad37426d',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:790_000_000,
    license:'Gemma',sourceModel:'google/gemma-3-1b-it',preferBackground:false,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:false,code:true}),
    artifacts:[
      ['config.json',1_000,true],['tokenizer.json',20_000_000,true],['tokenizer_config.json',1_000,true],
      ['generation_config.json',100,true],['chat_template.jinja',500,false],['special_tokens_map.json',100,true],
      ['onnx/model_q4f16.onnx',400_000,true],['onnx/model_q4f16.onnx_data',700_000_000,true]
    ]
  },
  {
    id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Large',hardwareTier:'Phone Large',status:'stable',installable:true,recommended:'capable',
    provider:'huggingface',repo:'onnx-community/Qwen3-1.7B-ONNX',revision:'e1da89f753284b95bd0971c64524f52edc5eb6e3',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:1_470_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-1.7B',preferBackground:true,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),
    artifacts:[
      ['config.json',500,true],['tokenizer.json',1_000_000,true],['tokenizer_config.json',500,true],
      ['generation_config.json',50,true],['chat_template.jinja',100,false],['onnx/model_q4f16.onnx',1_300_000_000,true]
    ]
  },
  {
    id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Mini PC',hardwareTier:'8–11 GB unified/system RAM',status:'stable',installable:true,recommended:'mini-pc',
    provider:'huggingface',repo:'HuggingFaceTB/SmolLM3-3B-ONNX',revision:'161c5e4dbaf4167f022f9c4dbd283ffef5f7bc51',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:2_160_000_000,
    license:'Apache-2.0',sourceModel:'HuggingFaceTB/SmolLM3-3B',preferBackground:false,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),
    artifacts:[
      ['config.json',500,true],['tokenizer.json',1_000_000,true],['tokenizer_config.json',500,true],
      ['generation_config.json',50,true],['chat_template.jinja',100,false],['special_tokens_map.json',50,true],
      ['onnx/model_q4f16.onnx',100_000,true],['onnx/model_q4f16.onnx_data',2_000_000_000,true]
    ]
  },
  {
    id:'qwen3-4b-q4f16',label:'Qwen 3 4B',tier:'PC 12',hardwareTier:'~12 GB system RAM',status:'stable',installable:true,recommended:'pc-12',
    provider:'huggingface',repo:'onnx-community/Qwen3-4B-ONNX',revision:'21d7994e6b4736786dce45b3eef15dd58304e4b3',
    task:'text-generation',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v3',estimatedBytes:2_860_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-4B',preferBackground:false,
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),
    artifacts:[
      ['config.json',1_000,true],['tokenizer.json',8_000_000,true],['tokenizer_config.json',1_000,true],
      ['generation_config.json',100,true],['chat_template.jinja',500,true],['special_tokens_map.json',100,true],
      ['onnx/model_q4f16.onnx',50_000_000,true],['onnx/model_q4f16.onnx_data',2_000_000_000,true],['onnx/model_q4f16.onnx_data_1',600_000_000,true]
    ]
  },
  {
    id:'qwen3-8b-ortgenai-int4',label:'Qwen 3 8B',tier:'PC 16',hardwareTier:'~16 GB system RAM',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/Qwen3-8B-ONNX',revision:'main',
    task:'text-generation',dtype:'int4',device:'webgpu',runtime:'onnxruntime-genai',estimatedBytes:5_000_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-8B',
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),
    reason:'Direct ONNX packages exist, but this repository is packaged for ONNX Runtime GenAI rather than Civweave’s currently pinned Transformers.js v3 text-generation lane. Download is held until that runtime lane is integrated so users are never offered a package the app cannot run.'
  },
  {
    id:'qwen3-14b-hardware-target',label:'Qwen 3 14B class',tier:'PC 32',hardwareTier:'~32 GB system RAM',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'Qwen/Qwen3-14B',revision:'main',
    task:'text-generation',dtype:'int4',device:'webgpu',runtime:'large-model-runtime',estimatedBytes:9_000_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-14B',
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true}),
    reason:'This is the 32 GB hardware target. Civweave will not expose an in-app download until a pinned browser/local runtime package with a verified artifact manifest is available.'
  },
  {
    id:'gemma4-26b-a4b-workstation',label:'Gemma 4 26B A4B MoE',tier:'Workstation MoE',hardwareTier:'high-VRAM local GPU',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'google/gemma-4-26B-A4B',revision:'main',
    task:'image-text-to-text',dtype:'int4',device:'webgpu',runtime:'workstation-moe-runtime',estimatedBytes:18_000_000_000,
    license:'Apache-2.0',sourceModel:'google/gemma-4-26B-A4B',
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,vision:true}),
    reason:'Canonical workstation target. The upstream model is directly downloadable, but Civweave does not yet have a pinned browser/runtime artifact set for this MoE package. It remains gated until install and inference are verified end-to-end.'
  },
  {
    id:'qwen3.5-0.8b-q4f16',label:'Qwen 3.5 0.8B',tier:'Experimental',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/Qwen3.5-0.8B-ONNX',revision:'d85632356b5aec5ecf43ff506b282d6ece81611f',
    task:'image-text-to-text',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-next',estimatedBytes:560_000_000,
    license:'Apache-2.0',capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:false,code:true,vision:true}),
    reason:'Public ONNX/WebGPU artifacts exist, but the current Qwen3.5 browser instructions still target @huggingface/transformers@next.'
  },
  {
    id:'qwen3.5-2b-q4f16',label:'Qwen 3.5 2B',tier:'Experimental',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/Qwen3.5-2B-ONNX-OPT',revision:'main',
    task:'image-text-to-text',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-next',estimatedBytes:1_400_000_000,
    license:'Apache-2.0',capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,vision:true}),
    reason:'Public browser ONNX builds exist, but the browser path still targets a newer Transformers.js channel.'
  },
  {
    id:'gemma4-e2b-it-q4f16',label:'Gemma 4 E2B IT',tier:'Experimental',status:'runtime-preview',installable:false,
    provider:'huggingface',repo:'onnx-community/gemma-4-E2B-it-ONNX',revision:'main',
    task:'any-to-any',dtype:'q4f16',device:'webgpu',runtime:'transformers-js-v4',estimatedBytes:2_000_000_000,
    license:'Apache-2.0',capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:true,code:true,vision:true}),
    reason:'Public Transformers.js conversion exists, but Gemma 4 uses a newer multimodal multi-graph runtime than Civweave’s pinned local text lane.'
  }
].map(freezeModel);
const runtimeModels=[
  {
    id:'qwen3-0.6b-q8-wasm',label:'Qwen 3 0.6B CPU compatibility',tier:'Compatibility',status:'stable',installable:true,hidden:true,
    provider:'huggingface',repo:'onnx-community/Qwen3-0.6B-ONNX',revision:'558750086ed49d78cb701ed6fa85af33fd16453f',
    task:'text-generation',dtype:'q8',device:'wasm',runtime:'transformers-js-v3',estimatedBytes:660_000_000,
    license:'Apache-2.0',sourceModel:'Qwen/Qwen3-0.6B',
    capabilities:caps({interactive:true,structuredOutput:true,agenticReasoning:false,code:true}),
    artifacts:[
      ['config.json',500,true],['tokenizer.json',1_000_000,true],['tokenizer_config.json',500,true],
      ['generation_config.json',50,true],['chat_template.jinja',100,false],['onnx/model_quantized.onnx',600_000_000,true]
    ]
  }
].map(freezeModel);
function byId(id){return [...models,...runtimeModels].find(model=>model.id===String(id||''))||null}
function directUrl(modelOrId,path){const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;if(!model)throw new Error('Unknown Civweave local model.');const clean=String(path||'').replace(/^\/+/, '');return `${HF}/${model.repo}/resolve/${encodeURIComponent(model.revision)}/${clean}`}
function sourceUrl(modelOrId){const model=typeof modelOrId==='string'?byId(modelOrId):modelOrId;if(!model)return'';return `${HF}/${model.repo}/tree/${encodeURIComponent(model.revision)}`}
function installable(){return models.filter(model=>model.installable)}
function experimental(){return models.filter(model=>!model.installable)}
function cpuFallback(){return runtimeModels[0]||null}
function capable(request={}){const broker=globalThis.CivweaveAICapabilityBrokerV268;return installable().filter(model=>broker?.supportsLocalRequest?.(model,request)?.ok)}
const api=Object.freeze({version:VERSION,host:HF,models:Object.freeze(models),runtimeModels:Object.freeze(runtimeModels),byId,directUrl,sourceUrl,installable,experimental,cpuFallback,capable});
globalThis.CivweaveLocalModelRegistryV266=api;
dispatchEvent(new CustomEvent('civweave:local-model-registry-ready',{detail:{version:VERSION,count:models.length,installable:installable().length,capabilityAware:true,runtimeMetadataRequired:true,backendFallback:true,phone1BTier:true,hardwareLadder:true,directDownloads:true}}));
})();

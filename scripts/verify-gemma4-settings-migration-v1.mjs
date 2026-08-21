import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const includes=(source,needle,label)=>assert(source.includes(needle),`${label} is missing ${needle}`);
const before=(source,a,b,label)=>{
  const left=source.indexOf(a),right=source.indexOf(b);
  assert(left>=0,`${label} is missing ${a}`);
  assert(right>=0,`${label} is missing ${b}`);
  assert(left<right,`${label} must place ${a} before ${b}`);
};

const settingsPath='public/app/model-settings-controller-v173.js';
const retirementPath='public/app/local-ai/gemma4-q2-retirement-v1.js';
new vm.Script(read(settingsPath),{filename:settingsPath});
new vm.Script(read(retirementPath),{filename:retirementPath});

const settings=read(settingsPath);
includes(settings,"VERSION='1.0.16-model-settings-controller-v173-gemma4-current-phone-pack'",'model settings controller');
includes(settings,"const GEMMA4_FAST_VERSION='1.1.0-gemma4-litert-fast-extension-v1-dual-phone'",'model settings controller');
includes(settings,"const GEMMA4_PHONE_VERSION='1.2.0-gemma4-phone-performance-core-v1-resume-authority'",'model settings controller');
includes(settings,"const GEMMA4_Q2_RETIRE_VERSION='1.0.0-gemma4-q2-retirement-v1'",'model settings controller');
includes(settings,"gemma4PackCore:'litert-current+q4-compatibility'",'model settings controller');
includes(settings,"gemma4FastModel:'gemma4-e2b-it-litert-web'",'model settings controller');
includes(settings,"gemma4DeepModel:'gemma4-e4b-it-litert-web'",'model settings controller');
includes(settings,"gemma4CompatibilityModels:Object.freeze(['gemma4-e2b-it-q4f16','gemma4-e4b-it-q4f16'])",'model settings controller');
includes(settings,"gemma4RetiredModels:Object.freeze(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile'])",'model settings controller');
includes(settings,'gemma4Q2OptionalExtension:false','model settings controller');
includes(settings,'gemma4Q2Retired:true','model settings controller');
includes(settings,'gemma4ObsoleteDeleteAction:true','model settings controller');
includes(settings,'gemma4MaxVariantsPerSize:2','model settings controller');
before(settings,"loadScript(GEMMA4_PACK_SRC", "loadScript(GEMMA4_DEEP_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_DEEP_SRC", "loadScript(GEMMA4_ACTIONS_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_ACTIONS_SRC", "loadScript(GEMMA4_FAST_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_FAST_SRC", "loadScript(GEMMA4_PHONE_SRC",'settings model boot order');
before(settings,"loadScript(GEMMA4_PHONE_SRC", "loadScript(GEMMA4_Q2_RETIRE_SRC",'settings model boot order');

const retirement=read(retirementPath);
includes(retirement,"data-gemma4-obsolete-delete>Delete obsolete models",'obsolete-model cleanup UI');
includes(retirement,'data-gemma4-obsolete-replace>Install current phone models','obsolete-model replacement UI');
includes(retirement,'m.select?.(replacement)','safe obsolete-model cleanup');
includes(retirement,'await m.remove(id)','explicit obsolete-model cleanup');
includes(retirement,'q4Preserved:true','obsolete-model cleanup contract');
includes(retirement,'explicitDelete:true','obsolete-model cleanup contract');
includes(retirement,'maxSupportedVariantsPerGemmaSize:2','obsolete-model cleanup contract');
includes(retirement,'function activate(){scheduleDecorate();return true}','obsolete models must not auto-delete');

console.log('PASS Local Models boots the current LiteRT + Q4 Gemma 4 stack, marks Q2 retired, and exposes explicit safe cleanup for existing Q2 downloads.');

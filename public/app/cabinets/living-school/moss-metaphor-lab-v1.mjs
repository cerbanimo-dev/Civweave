/*
 * Moss Metaphor Lab v1: declarative interactive learning, no model-authored code execution.
 * Model output is plain JSON. The trusted host owns DOM, CSS, events, and state transitions.
 */
import {state,activeModule,progressFor,persist,escapeHtml as escape,clean} from './living-school-cleanroom-core-v218.mjs';

export const VERSION='1.0.0-moss-metaphor-lab';
const STYLE_ID='moss-metaphor-lab-v1-style';
const ROOT_ID='moss-metaphor-lab-v1';
const ACTION='data-moss-metaphor-action';
const THEMES=new Set(['garden','river','workshop','stars']);
let generating=false;
let initialized=false;
let errorMessage='';
const text=(value,max=700)=>clean(value,max).replace(/[\u0000-\u001f\u007f]/g,' ');
const list=value=>Array.isArray(value)?value:[];
const validString=(value,max)=>typeof value==='string'&&Boolean(value.trim())&&value.length<=max;
const escapeText=(value,max=700)=>escape(text(value,max));
const time=()=>new Date().toISOString();

export function validateMetaphor(candidate){
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw Error('Moss did not return a metaphor object.');
  if(!validString(candidate.title,120)||!validString(candidate.world,700)||!validString(candidate.analogy,950)||!validString(candidate.transferPrompt,500)||!validString(candidate.limitation,500))throw Error('The metaphor narrative, transfer prompt, or limitations were incomplete.');
  const mapping=list(candidate.mapping),steps=list(candidate.steps);
  if(mapping.length<2||mapping.length>6||steps.length<2||steps.length>4)throw Error('The metaphor needs 2–6 concept mappings and 2–4 interactive scenes.');
  for(const row of mapping)if(!validString(row?.image,140)||!validString(row?.concept,220)||!validString(row?.relation,350))throw Error('A metaphor-to-concept mapping is incomplete.');
  for(const step of steps){
    if(!validString(step?.scene,900)||!validString(step?.question,450))throw Error('A metaphor scene or decision is incomplete.');
    const dial=step.kind==='dial',values=dial?list(step.dial?.levels):list(step.choices);
    if(values.length<(dial?3:2)||values.length>(dial?5:4))throw Error('A scene needs 2–4 decisions or 3–5 dial settings.');
    if(values.filter(choice=>choice?.correct===true).length!==1)throw Error('Each scene needs exactly one supported answer.');
    if(dial&&!validString(step.dial?.label,180))throw Error('The interactive dial must have a meaningful label.');
    for(const choice of values)if(!validString(choice?.label,240)||!validString(choice?.feedback,480)||typeof choice.correct!=='boolean'||(dial&&!validString(choice?.worldState,450)))throw Error('A scene option needs a meaningful label, feedback, and consequence.');
  }
  if(candidate.theme!=null&&!THEMES.has(candidate.theme))throw Error('The scene theme is not supported.');
  // Copy only approved, bounded text and booleans. Ignore all markup, URLs, scripts, styles, and extra fields.
  return {
    title:text(candidate.title,120),world:text(candidate.world,700),analogy:text(candidate.analogy,950),
    theme:THEMES.has(candidate.theme)?candidate.theme:'garden',
    mapping:mapping.map(row=>({image:text(row.image,140),concept:text(row.concept,220),relation:text(row.relation,350)})),
    steps:steps.map(step=>({
      scene:text(step.scene,900),question:text(step.question,450),kind:step.kind==='dial'?'dial':'choice',
      ...(step.kind==='dial'?{dial:{label:text(step.dial.label,180),levels:step.dial.levels.map(level=>({label:text(level.label,240),worldState:text(level.worldState,450),feedback:text(level.feedback,480),correct:level.correct}))}}:{choices:step.choices.map(choice=>({label:text(choice.label,240),feedback:text(choice.feedback,480),correct:choice.correct}))})
    })),
    transferPrompt:text(candidate.transferPrompt,500),limitation:text(candidate.limitation,500)
  };
}

function responseJson(result){
  const direct=result?.outputJson;
  if(direct&&typeof direct==='object'&&!Array.isArray(direct))return direct;
  const raw=String(result?.outputText||result?.text||'').trim();
  const stripped=raw.replace(/^~~~(?:json)?\s*/i,'').replace(/\s*~~~$/,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(stripped)}catch{throw Error('The model did not return usable interactive-module JSON. Retry to create a new metaphor.');}
}

function schema(){
  const string={type:'string'},choice={type:'object',required:['label','feedback','correct'],properties:{label:string,feedback:string,correct:{type:'boolean'}}},level={type:'object',required:['label','worldState','feedback','correct'],properties:{label:string,worldState:string,feedback:string,correct:{type:'boolean'}}};
  return {type:'object',required:['title','world','analogy','mapping','steps','transferPrompt','limitation'],properties:{
    title:string,world:string,analogy:string,theme:{type:'string',enum:[...THEMES]},
    mapping:{type:'array',minItems:2,maxItems:6,items:{type:'object',required:['image','concept','relation'],properties:{image:string,concept:string,relation:string}}},
    steps:{type:'array',minItems:2,maxItems:4,items:{type:'object',required:['scene','question'],properties:{scene:string,question:string,kind:{type:'string',enum:['choice','dial']},choices:{type:'array',minItems:2,maxItems:4,items:choice},dial:{type:'object',required:['label','levels'],properties:{label:string,levels:{type:'array',minItems:3,maxItems:5,items:level}}}}}},
    transferPrompt:string,limitation:string
  }};
}
function scopeFingerprint(module){
  return [module?.title,module?.objective,...list(module?.lessonBlocks).slice(0,2).map(block=>block?.content)].map(value=>text(value,400)).join('|').slice(0,1300);
}
function exactModule(schoolId,moduleId){
  const s=state();
  return s.school?.id===schoolId&&s.school.modules?.find(item=>item.id===moduleId);
}
function setLab(schoolId,moduleId,lab,event){
  if(!exactModule(schoolId,moduleId))return false;
  const s=state(),old=progressFor(moduleId);
  s.progress[moduleId]={...old,metaphorLab:lab};
  persist(event,{schoolId,moduleId,version:VERSION,completed:lab.completed===true});
  return true;
}

async function generate(){
  if(generating)return;
  const module=activeModule(),s=state(),schoolId=s.school?.id,moduleId=module?.id;
  if(!schoolId||!moduleId)throw Error('Open a generated Living School module first.');
  generating=true;errorMessage='';mount();
  try{
    await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
    const runtime=globalThis.CivweaveModelRuntime;
    const config=runtime?.readSharedConfig?.('interactive');
    if(!runtime?.generate||!config)throw Error('Select a working local or cloud AI in Civweave AI Settings to invent a metaphor. Previously generated metaphors remain usable offline.');
    const context={
      capability:text(s.school.capability,750),moduleId,title:text(module.title,220),objective:text(module.objective,850),
      concepts:list(module.concepts).slice(0,8).map(c=>({term:text(c?.term||c,120),definition:text(c?.definition||'',420)})),
      lessonBlocks:list(module.lessonBlocks).slice(0,4).map(b=>({heading:text(b?.heading,140),content:text(b?.content,1200),sourceIds:list(b?.sourceIds).slice(0,6).map(id=>text(id,100)),provenance:text(b?.provenance,80)})),
      learnerLevel:text(s.school.level||'beginner',40)
    };
    const result=await runtime.generate({
      purpose:'living-school-moss-metaphor-lab-v1',executionProfile:'interactive',config:{
        ...config,temperature:0.65,maxTokens:Math.max(2500,Math.min(5000,Number(config.maxTokens)||3500))
      },schema:schema(),maxRepairAttempts:1,context,
      ...(String(config.provider||config.route||'').toLowerCase()==='ollama'?{think:false}:{}),
      messages:[
        {role:'system',content:'You are Moss, a creative and accurate tutor. Invent ONE novel metaphor-driven, browser-playable activity for the provided lesson. Output ONLY strict JSON matching the schema. No code, HTML, CSS, markdown, URLs, external references, APIs, or tools. Build a coherent imaginary world; map concrete imagery to the REAL lesson concepts and explicitly name where the analogy stops working. Include 2–4 sequential scenes with a variety of mechanics: kind choice with 2–4 choices, OR kind dial with dial.label and 3–5 levels, each a label, worldState, feedback and correct boolean. A dial changes an imaginary condition so learners can experiment with its consequences. Use at least one dial if the subject allows meaningful variation. Every scene has exactly one supported answer, and other settings reveal useful misconceptions; feedback must explain causality, not just whether an answer is right. End with a transfer-to-real-life question. Avoid trivia or obvious options; make the learner experiment mentally. Never claim that an analogy is an evidence source.'},
        {role:'user',content:'Create a fresh interactive metaphor for this module, in a way that matches the learner level. Use only the following lesson facts, and distinguish creative analogy from source-backed claims:\n'+JSON.stringify(context)}
      ]
    });
    if(result?.status!=='success')throw Error(text(result?.error?.message||result?.error||'Metaphor generation did not succeed.',1000));
    const spec=validateMetaphor(responseJson(result));
    const lab={schema:'civweave.moss-metaphor-lab.v1',schoolId,moduleId,scopeFingerprint:scopeFingerprint(module),spec,at:time(),step:0,answers:[],reflection:'',completed:false,provider:text(result?.actual?.provider||config.provider||config.route,80),model:text(result?.actual?.model||config.model,120)};
    if(!setLab(schoolId,moduleId,lab,'moss-metaphor-created'))throw Error('The learning module changed during generation; the detached activity was not saved.');
  }catch(err){errorMessage=text(err?.message||err,1200);}
  finally{generating=false;mount();}
}

function labContext(){
  const module=activeModule(),s=state(),schoolId=s.school?.id,moduleId=module?.id;
  if(!schoolId||!moduleId)return null;
  const lab=progressFor(moduleId).metaphorLab;
  if(lab?.schema!=='civweave.moss-metaphor-lab.v1'||lab.schoolId!==schoolId||lab.moduleId!==moduleId||lab.scopeFingerprint!==scopeFingerprint(module))return {schoolId,moduleId,lab:null};
  try{return {schoolId,moduleId,lab:{...lab,spec:validateMetaphor(lab.spec)}}}catch{return {schoolId,moduleId,lab:null}}

}
function withUpdatedLab(ctx,change,event){
  if(!ctx?.lab)return;
  const next={...ctx.lab,...change};
  setLab(ctx.schoolId,ctx.moduleId,next,event);
  mount();
}
function style(){
  if(document.getElementById(STYLE_ID))return;
  const el=document.createElement('style');el.id=STYLE_ID;
  el.textContent=[
    '#'+ROOT_ID+'{margin:18px 0;padding:16px;border:1px solid #6c9d7b;border-radius:17px;background:#10251d;color:#e6f4e7;contain:layout style}',
    '#'+ROOT_ID+' h3{margin:2px 0 8px;color:#d0f2d3} #'+ROOT_ID+' p{line-height:1.6}',
    '#'+ROOT_ID+' .mml-top{display:flex;gap:10px;justify-content:space-between;align-items:start;flex-wrap:wrap}',
    '#'+ROOT_ID+' .mml-kicker{color:#a6dfae;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}',
    '#'+ROOT_ID+' .mml-world{padding:14px;border-radius:12px;background:#244434;margin:12px 0;box-shadow:inset 0 0 0 1px #447356}',
    '#'+ROOT_ID+'[data-theme="river"] .mml-world{background:#183e46} #'+ROOT_ID+'[data-theme="workshop"] .mml-world{background:#473923} #'+ROOT_ID+'[data-theme="stars"] .mml-world{background:#2d294c}',
    '#'+ROOT_ID+' .mml-mappings{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:8px;margin:12px 0}',
    '#'+ROOT_ID+' .mml-mapping{background:#1c352a;border:1px solid #456b51;border-radius:11px;padding:10px}',
    '#'+ROOT_ID+' .mml-mapping b{display:block;color:#bfe9c5} #'+ROOT_ID+' .mml-mapping small{display:block;color:#c5d9c8;line-height:1.5}',
    '#'+ROOT_ID+' .mml-choices{display:grid;gap:8px;margin:12px 0}',
    '#'+ROOT_ID+' .mml-dial{display:grid;gap:10px;padding:12px;background:#1a3b30;border-radius:12px;margin:12px 0}',
    '#'+ROOT_ID+' .mml-dial input[type="range"]{width:100%;accent-color:#c9e8a5;min-height:42px}',
    '#'+ROOT_ID+' .mml-dial-output{padding:10px;border:1px solid #73977e;border-radius:10px;min-height:60px}',
    '#'+ROOT_ID+' button{appearance:none;padding:10px 12px;background:#2b5940;border:1px solid #76ae87;border-radius:10px;color:#f6fff7;font:inherit;text-align:left;cursor:pointer;min-height:44px}',
    '#'+ROOT_ID+' button:hover:not(:disabled){background:#3b7353} #'+ROOT_ID+' button:focus-visible{outline:3px solid #f5d678;outline-offset:2px}',
    '#'+ROOT_ID+' button:disabled{opacity:.55;cursor:not-allowed} #'+ROOT_ID+' .mml-choice[aria-pressed="true"]{border-color:#f4d77e;background:#35573d}',
    '#'+ROOT_ID+' .mml-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0} #'+ROOT_ID+' .mml-note{padding:10px;background:#26392c;border-left:3px solid #b8dea5;border-radius:8px}',
    '#'+ROOT_ID+' textarea{display:block;width:100%;min-height:88px;margin:7px 0;padding:10px;border:1px solid #719a7b;background:#0c1f18;color:#fff;border-radius:10px;font:inherit}',
    '#'+ROOT_ID+' .mml-foot{font-size:.78rem;color:#c7d8c5;margin-top:10px} #'+ROOT_ID+' .mml-status{color:#efdf9b}',
    '@media(max-width:520px){#'+ROOT_ID+'{padding:12px} #'+ROOT_ID+' .mml-actions{display:grid} #'+ROOT_ID+' .mml-actions button{width:100%}}'
  ].join('\n');
  document.head.appendChild(el);
}
function button(action,label,extra=''){
  return '<button type="button" '+ACTION+'="'+action+'" '+extra+'>'+escapeText(label,240)+'</button>';
}
function detail(ctx){
  const lab=ctx.lab,spec=lab.spec,stepIndex=Math.min(Math.max(Number(lab.step)||0,0),spec.steps.length),stage=spec.steps[stepIndex],answer=lab.answers?.[stepIndex],done=stepIndex>=spec.steps.length;
  const maps=spec.mapping.map(row=>'<div class="mml-mapping"><b>'+escapeText(row.image,140)+' → '+escapeText(row.concept,220)+'</b><small>'+escapeText(row.relation,350)+'</small></div>').join('');
  let body='<div class="mml-world"><b>The imaginary world</b><p>'+escapeText(spec.world,700)+'</p><p>'+escapeText(spec.analogy,950)+'</p></div><div class="mml-mappings" aria-label="Metaphor concept map">'+maps+'</div>';
  if(stage){
    body+='<div class="mml-world"><span class="mml-kicker">Scene '+(stepIndex+1)+' of '+spec.steps.length+'</span><p>'+escapeText(stage.scene,900)+'</p><h4>'+escapeText(stage.question,450)+'</h4></div>';
    const options=stage.kind==='dial'?stage.dial.levels:stage.choices;
    if(stage.kind==='dial'){
      const selected=Number.isInteger(answer?.choice)?answer.choice:0,level=options[selected];
      body+='<div class="mml-dial"><label for="mml-dial-range">'+escapeText(stage.dial.label,180)+'</label><input id="mml-dial-range" type="range" min="0" max="'+(options.length-1)+'" step="1" value="'+selected+'" aria-describedby="mml-dial-output"><div id="mml-dial-output" class="mml-dial-output" role="status"><b>'+escapeText(level.label,240)+'</b><p>'+escapeText(level.worldState,450)+'</p></div>'+button('set-dial','Apply this setting')+'</div>';
    }else body+='<div class="mml-choices" role="group" aria-label="Choose a response">'+stage.choices.map((choice,i)=>button('choose',choice.label,'class="mml-choice" data-choice-index="'+i+'" aria-pressed="'+(answer?.choice===i)+'"')).join('')+'</div>';
    if(answer)body+='<div class="mml-note" role="status"><b>'+(answer.correct?'That fits the lesson.':'Try another approach.')+'</b><p>'+escapeText(options[answer.choice]?.feedback||'',480)+'</p></div>';
    if(answer?.correct)body+='<div class="mml-actions">'+button('next',stepIndex===spec.steps.length-1?'Reflect on the lesson':'Continue the story')+'</div>';
  }else if(done){
    body+='<div class="mml-note"><b>Metaphor explored</b><p>Now transfer the insight out of the imaginary world. This activity is practice, not the module assessment.</p></div>';
  }
  if(done){
    body+='<label for="mml-reflection">Transfer the idea to reality</label><p>'+escapeText(spec.transferPrompt,500)+'</p><textarea id="mml-reflection" maxlength="1800" placeholder="Explain the actual concept, not just the metaphor.">'+escapeText(lab.reflection||'',1800)+'</textarea>';
    body+='<div class="mml-actions">'+button('save-reflection','Save my reflection')+button('restart','Replay scenes')+'</div>';
    if(lab.reflection)body+='<div class="mml-note" role="status">Reflection saved locally. Continue the module’s normal evidence and assessment steps.</div>';
  }
  body+='<details><summary>Where this metaphor breaks down</summary><p>'+escapeText(spec.limitation,500)+'</p></details>';
  body+='<p class="mml-foot">AI-authored learning analogy · '+escapeText(lab.provider||'selected AI',80)+' · '+escapeText(lab.model||'',120)+' · Not a source citation or assessment pass.</p>';
  return body;
}
export function mount(){
  const root=document.getElementById('lsc218-module');if(!root)return false;
  const ctx=labContext();if(!ctx)return false;
  style();
  let section=document.getElementById(ROOT_ID);
  if(!section||!root.contains(section)){
    section=document.createElement('section');section.id=ROOT_ID;section.setAttribute('aria-label','Moss interactive metaphor lab');
    const anchor=root.querySelector('.lsc218-visual')?.closest('.lsc218-content-block')||root.querySelector('.lsc218-definitions')?.closest('.lsc218-content-block')||root.querySelector('.lsc218-contract-grid');
    if(anchor)anchor.insertAdjacentElement('afterend',section);else root.appendChild(section);
  }
  section.dataset.theme=ctx.lab?.spec?.theme||'garden';
  const header='<div class="mml-top"><div><span class="mml-kicker">Moss · Interactive Metaphor Lab</span><h3>'+(ctx.lab?escapeText(ctx.lab.spec.title,120):'Make the lesson come alive')+'</h3></div>'+button('generate',ctx.lab?'Invent another metaphor':'Invent a metaphor',generating?'disabled':'')+'</div>';
  const description=!ctx.lab?'<p>Ask Moss to invent a playable analogy from this lesson: explore a world, make decisions, see consequences, then connect the experience back to the actual concept.</p>':'';
  const busy=generating?'<p class="mml-status" role="status">Moss is building the interactive scenes using the selected AI…</p>':'';
  const error=errorMessage?'<p class="mml-status" role="alert">'+escapeText(errorMessage,1200)+'</p>':'';
  section.innerHTML=header+description+busy+error+(ctx.lab?detail(ctx):'')+(!ctx.lab?'<p class="mml-foot">Generated modules are saved with this lesson. Existing saved metaphors work offline. No model-authored HTML, scripts, or external resources are executed.</p>':'');
  return true;
}
function handleAction(event){
  const target=event.target?.closest?.('['+ACTION+']');
  if(!target||!document.getElementById(ROOT_ID)?.contains(target))return;
  event.preventDefault();event.stopImmediatePropagation();
  const action=target.getAttribute(ACTION);
  if(action==='generate'){generate();return}
  const ctx=labContext(),lab=ctx?.lab;if(!lab||generating)return;
  if(action==='choose'||action==='set-dial'){
    const step=Number(lab.step)||0,stage=lab.spec.steps[step];
    if(!stage||(action==='set-dial')!==(stage.kind==='dial'))return;
    const choices=stage.kind==='dial'?stage.dial.levels:stage.choices;
    const choiceIndex=action==='set-dial'?Number(document.getElementById('mml-dial-range')?.value):Number(target.dataset.choiceIndex);
    if(!Number.isInteger(choiceIndex)||choiceIndex<0||choiceIndex>=choices.length)return;
    const answers=[...list(lab.answers).slice(0,step),{choice:choiceIndex,correct:choices[choiceIndex].correct,at:time()}];
    withUpdatedLab(ctx,{answers},'moss-metaphor-choice');return;
  }
  if(action==='next'){
    const step=Number(lab.step)||0;
    if(!lab.answers?.[step]?.correct)return;
    withUpdatedLab(ctx,{step:Math.min(step+1,lab.spec.steps.length),completed:step+1>=lab.spec.steps.length},'moss-metaphor-scene-completed');return;
  }
  if(action==='restart'){withUpdatedLab(ctx,{step:0,answers:[],completed:false},'moss-metaphor-replayed');return}
  if(action==='save-reflection'){
    if(Number(lab.step)<lab.spec.steps.length)return;
    const reflection=text(document.getElementById('mml-reflection')?.value,1800);
    if(!reflection){errorMessage='Write a reflection before saving it.';mount();return}
    errorMessage='';withUpdatedLab(ctx,{reflection,completed:true},'moss-metaphor-reflection-saved');
  }
}
function handleDialInput(event){
  const input=event.target;
  if(input?.id!=='mml-dial-range'||!document.getElementById(ROOT_ID)?.contains(input))return;
  const stage=labContext()?.lab?.spec?.steps?.[labContext()?.lab?.step||0];
  if(stage?.kind!=='dial')return;
  const index=Number(input.value),level=stage.dial.levels[index],output=document.getElementById('mml-dial-output');
  if(!level||!output)return;
  output.replaceChildren();
  const title=document.createElement('b');title.textContent=level.label;
  const description=document.createElement('p');description.textContent=level.worldState;
  output.append(title,description);
}
export function install(){
  if(initialized)return;
  initialized=true;
  document.addEventListener('click',handleAction,true);
  document.addEventListener('input',handleDialInput,true);
  mount();
}

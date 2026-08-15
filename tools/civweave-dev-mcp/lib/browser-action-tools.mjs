import { clickPoint, elementPoint, evaluate, SNAPSHOT_EXPRESSION, validateNavigationUrl, withPage } from './browser-common.mjs';
import { JSON_OBJECT, textResult } from './tool-utils.mjs';

export function registerBrowserActionTools(add, config) {
  add({ name:'pwa.navigate', title:'Navigate PWA target', description:'Navigate an existing debuggable page to an HTTP(S) URL. This changes browser navigation state but never edits or injects application source.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},url:{type:'string'}},required:['url']}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},
    async (args) => textResult(await withPage(config,args,async(client)=>{ const url=validateNavigationUrl(args.url); const result=await client.call('Page.navigate',{url}); return {navigated:true,frameId:result.frameId,url}; })));

  add({ name:'pwa.reload', title:'Reload PWA target', description:'Reload the current target normally or while bypassing the HTTP cache. Does not alter source files.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},ignoreCache:{type:'boolean'}}}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,async(client)=>{ await client.call('Page.reload',{ignoreCache:Boolean(args.ignoreCache)}); return {reloaded:true,ignoreCache:Boolean(args.ignoreCache)}; })));

  add({ name:'pwa.click', title:'Click PWA element', description:'Click a visible element selected by CSS selector through CDP pointer input. This reproduces browser interaction without DOM mutation or runtime source injection.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},selector:{type:'string'}},required:['selector']}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,async(client)=>{ const point=await elementPoint(client,args.selector); await clickPoint(client,point); return {clicked:true,tag:point.tag,id:point.id}; })));

  add({ name:'pwa.type', title:'Type into PWA field', description:'Click a field and enter text through CDP keyboard/input events. Replace mode uses select-all plus backspace, not direct DOM value assignment.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},selector:{type:'string'},text:{type:'string'},replace:{type:'boolean'}},required:['selector','text']}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,async(client)=>{
      const point=await elementPoint(client,args.selector);
      await clickPoint(client,point);
      if(args.replace){
        await client.call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65,nativeVirtualKeyCode:65,commands:['SelectAll']});
        await client.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65,nativeVirtualKeyCode:65});
        await client.call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8,nativeVirtualKeyCode:8});
        await client.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8,nativeVirtualKeyCode:8});
      }
      await client.call('Input.insertText',{text:args.text});
      return {typed:true,characters:args.text.length,replaced:Boolean(args.replace)};
    })));

  add({ name:'pwa.scroll', title:'Scroll PWA', description:'Send a bounded mouse-wheel input through CDP to test real scroll behavior and freezes without calling scrollBy or mutating DOM state directly.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},deltaY:{type:'number',minimum:-5000,maximum:5000}},required:['deltaY']}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,async(client)=>{ const center=await evaluate(client,'({x:innerWidth/2,y:innerHeight/2})'); await client.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:center.x,y:center.y,deltaX:0,deltaY:Number(args.deltaY)}); await new Promise((resolve)=>setTimeout(resolve,25)); return await evaluate(client,'({x:scrollX,y:scrollY})'); })));

  add({ name:'pwa.watch', title:'Watch PWA diagnostics', description:'Collect console messages, runtime exceptions, failed network requests, lifecycle events, and bounded CDP performance-metric deltas for up to five seconds. Can optionally reload after listeners are attached to catch startup freezes; no observer or instrumentation is installed in the page.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},durationMs:{type:'integer',minimum:100,maximum:5000},reload:{type:'boolean'},ignoreCache:{type:'boolean'}}}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,async(client)=>{
      const events=[]; const push=(kind,data)=>{ if(events.length<500) events.push({kind,data}); };
      const off=[
        client.on('Runtime.consoleAPICalled',(p)=>push('console',{type:p.type,args:(p.args||[]).map((a)=>a.value ?? a.description).slice(0,12)})),
        client.on('Runtime.exceptionThrown',(p)=>push('exception',{text:p.exceptionDetails?.text,description:p.exceptionDetails?.exception?.description})),
        client.on('Network.loadingFailed',(p)=>push('network-failed',{url:p.url,errorText:p.errorText,canceled:p.canceled,blockedReason:p.blockedReason})),
        client.on('Page.lifecycleEvent',(p)=>push('lifecycle',{name:p.name,timestamp:p.timestamp})),
      ];
      const diagnosticErrors=[];
      const safe = async (label, fn) => { try { return await fn(); } catch (error) { diagnosticErrors.push({label,error:error instanceof Error?error.message:String(error)}); return null; } };
      await safe('Network.enable',()=>client.call('Network.enable'));
      await safe('Performance.enable',()=>client.call('Performance.enable'));
      await safe('Page.setLifecycleEventsEnabled',()=>client.call('Page.setLifecycleEventsEnabled',{enabled:true}));
      const beforeMetrics=await safe('Performance.getMetrics:before',()=>client.call('Performance.getMetrics'));
      if(args.reload) await safe('Page.reload',()=>client.call('Page.reload',{ignoreCache:Boolean(args.ignoreCache)}));
      await new Promise((resolve)=>setTimeout(resolve,Math.min(Math.max(args.durationMs ?? 1500,100),5000)));
      const afterMetrics=await safe('Performance.getMetrics:after',()=>client.call('Performance.getMetrics'));
      const metricMap=(payload)=>Object.fromEntries((payload?.metrics||[]).map((metric)=>[metric.name,metric.value]));
      const before=metricMap(beforeMetrics), after=metricMap(afterMetrics);
      const metricDelta={};
      for(const name of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','JSHeapUsedSize','Nodes','Documents']) {
        if(name in after) metricDelta[name]={before:before[name]??null,after:after[name],delta:typeof before[name]==='number'?after[name]-before[name]:null};
      }
      off.forEach((fn)=>fn());
      const snapshot=await safe('snapshot',()=>evaluate(client,SNAPSHOT_EXPRESSION));
      return {events,metricDelta,snapshot,diagnosticErrors};
    })));
}

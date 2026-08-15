import { listTargets } from './cdp-client.mjs';
import { evaluate, RUNTIME_EXPRESSION, SNAPSHOT_EXPRESSION, withPage } from './browser-common.mjs';
import { JSON_OBJECT, textResult } from './tool-utils.mjs';

export function registerBrowserReadTools(add, config) {
  add({ name:'pwa.list_targets', title:'List PWA browser targets', description:'List Chromium/Opera pages exposed through the configured local Chrome DevTools Protocol endpoint.', inputSchema:{...JSON_OBJECT,properties:{}}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async () => textResult({ targets: await listTargets(config.cdpEndpoint, config.fetchImpl) }));

  add({ name:'pwa.snapshot', title:'Inspect active PWA', description:'Read the active page URL, viewport, scroll state, modal state, viewport-covering fixed elements, service-worker controller, and interaction-related computed styles without changing the application.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'}}}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,(client)=>evaluate(client,SNAPSHOT_EXPRESSION))));

  add({ name:'pwa.runtime_state', title:'Inspect Civweave runtime state', description:'Read service-worker registrations, cache names, browser storage key names, and Civweave-related global namespaces. Does not execute caller-supplied JavaScript and does not patch runtime state.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'}}}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,(client)=>evaluate(client,RUNTIME_EXPRESSION))));

  add({ name:'pwa.query', title:'Inspect PWA elements', description:'Read matching DOM elements by CSS selector, including text, form value, accessibility attributes, geometry, and interaction-related computed styles. This is read-only and does not expose arbitrary JavaScript evaluation.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},selector:{type:'string'},maxResults:{type:'integer',minimum:1,maximum:50}},required:['selector']}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => textResult(await withPage(config,args,(client)=>evaluate(client,`(() => [...document.querySelectorAll(${JSON.stringify(args.selector)})].slice(0,${Math.min(Math.max(args.maxResults ?? 20,1),50)}).map((el) => { const s=getComputedStyle(el), r=el.getBoundingClientRect(); return {tag:el.tagName,id:el.id,className:String(el.className||'').slice(0,300),text:String(el.innerText ?? el.textContent ?? '').trim().slice(0,1000),value:'value' in el ? String(el.value).slice(0,1000) : undefined,checked:'checked' in el ? Boolean(el.checked) : undefined,disabled:'disabled' in el ? Boolean(el.disabled) : undefined,hidden:Boolean(el.hidden),role:el.getAttribute('role'),ariaLabel:el.getAttribute('aria-label'),ariaExpanded:el.getAttribute('aria-expanded'),rect:{x:r.x,y:r.y,width:r.width,height:r.height},style:{display:s.display,visibility:s.visibility,pointerEvents:s.pointerEvents,position:s.position,zIndex:s.zIndex}}; }))()`))));

  add({ name:'pwa.screenshot', title:'Capture PWA screenshot', description:'Capture the currently rendered page as a PNG image through CDP.', inputSchema:{...JSON_OBJECT,properties:{targetId:{type:'string'},urlIncludes:{type:'string'},fullPage:{type:'boolean'}}}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => {
      const data = await withPage(config,args,async(client)=>{
        let clipArg;
        if (args.fullPage) {
          const metrics = await client.call('Page.getLayoutMetrics');
          const size = metrics.cssContentSize ?? metrics.contentSize;
          if (size) clipArg = { x:0,y:0,width:Math.min(size.width,10000),height:Math.min(size.height,10000),scale:1 };
        }
        const result = await client.call('Page.captureScreenshot', { format:'png', fromSurface:true, captureBeyondViewport:Boolean(args.fullPage), ...(clipArg ? {clip:clipArg} : {}) });
        return result.data;
      });
      return { content:[{type:'image',data,mimeType:'image/png'}] };
    });
}

export async function withPage(config, args, fn) {
  const connection = await config.cdpFactory({
    endpoint: config.cdpEndpoint,
    targetId: args.targetId,
    urlIncludes: args.urlIncludes,
  });
  try {
    await connection.client.call('Runtime.enable');
    await connection.client.call('Page.enable');
    return await fn(connection.client, connection.target);
  } finally {
    await connection.client.close();
  }
}

export async function evaluate(client, expression, { awaitPromise = true, returnByValue = true } = {}) {
  const result = await client.call('Runtime.evaluate', { expression, awaitPromise, returnByValue, userGesture: false });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed';
    throw new Error(detail);
  }
  return result.result?.value;
}

export async function elementPoint(client, selector) {
  return await evaluate(client, `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Selector not found'); const style=getComputedStyle(el), r=el.getBoundingClientRect(); if(style.display==='none'||style.visibility==='hidden'||style.pointerEvents==='none'||r.width<=0||r.height<=0) throw new Error('Element is not visible or interactive'); return {tag:el.tagName,id:el.id,x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height}; })()`);
}

export function validateNavigationUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Navigation URL must be absolute'); }
  if (!['http:','https:'].includes(url.protocol)) throw new Error(`Navigation protocol is not allowed: ${url.protocol}`);
  return url.toString();
}

export async function clickPoint(client, point) {
  await client.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
  await client.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await client.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
}

export const SNAPSHOT_EXPRESSION = `(() => {
  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const style = (node) => node ? getComputedStyle(node) : null;
  const rootStyle = style(root), bodyStyle = style(body);
  const center = doc.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const fixed = [...doc.querySelectorAll('body *')].filter((el) => {
    const s = getComputedStyle(el); if (s.position !== 'fixed' || s.pointerEvents === 'none' || s.visibility === 'hidden' || s.display === 'none') return false;
    const r = el.getBoundingClientRect(); return r.width > innerWidth * .5 && r.height > innerHeight * .5;
  }).slice(0, 20).map((el) => ({tag: el.tagName, id: el.id, className: String(el.className || '').slice(0,200), zIndex: getComputedStyle(el).zIndex, pointerEvents: getComputedStyle(el).pointerEvents}));
  return {
    url: location.href, title: doc.title, readyState: doc.readyState, visibilityState: doc.visibilityState,
    viewport: {width: innerWidth, height: innerHeight, devicePixelRatio},
    scroll: {x: scrollX, y: scrollY, maxY: Math.max(0, root.scrollHeight - innerHeight)},
    activeElement: doc.activeElement ? {tag: doc.activeElement.tagName, id: doc.activeElement.id, className: String(doc.activeElement.className || '').slice(0,200)} : null,
    root: {className: root.className, overflow: rootStyle?.overflow, overflowY: rootStyle?.overflowY, pointerEvents: rootStyle?.pointerEvents},
    body: body ? {className: body.className, overflow: bodyStyle?.overflow, overflowY: bodyStyle?.overflowY, pointerEvents: bodyStyle?.pointerEvents} : null,
    centerElement: center ? {tag: center.tagName, id: center.id, className: String(center.className || '').slice(0,200)} : null,
    fixedViewportCoverings: fixed,
    dialogs: [...doc.querySelectorAll('dialog,[role=dialog],[aria-modal=true]')].slice(0,20).map((el) => ({tag: el.tagName,id:el.id,open:el.open ?? null,hidden:el.hidden,ariaHidden:el.getAttribute('aria-hidden')})),
    elementCount: doc.getElementsByTagName('*').length,
    serviceWorkerController: navigator.serviceWorker?.controller?.scriptURL ?? null,
    online: navigator.onLine
  };
})()`;

export const RUNTIME_EXPRESSION = `(async () => {
  const registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations().catch(() => []) : [];
  const cacheNames = globalThis.caches ? await caches.keys().catch(() => []) : [];
  const interesting = Object.getOwnPropertyNames(globalThis).filter((name) => /Civweave|Anarchadia|Living|Fellow|Cerbanimo|Settings|Weaveling|Moss|Kamiya|Rook|Merlin/i.test(name)).slice(0,120);
  const globals = interesting.map((name) => { let value; try { value = globalThis[name]; } catch { return {name, inaccessible:true}; }
    return {name, type: typeof value, keys: value && (typeof value === 'object' || typeof value === 'function') ? Object.keys(value).slice(0,40) : []}; });
  const safeStorageKeys = (storageName) => { try { return {accessible:true, keys:Object.keys(globalThis[storageName])}; } catch (error) { return {accessible:false, keys:[], error:error?.name || 'unavailable'}; } };
  const local = safeStorageKeys('localStorage'), session = safeStorageKeys('sessionStorage');
  return {
    href: location.href,
    serviceWorkers: registrations.map((r) => ({scope:r.scope, active:r.active?.scriptURL ?? null, waiting:r.waiting?.scriptURL ?? null, installing:r.installing?.scriptURL ?? null})),
    caches: cacheNames,
    localStorageKeys: local.keys,
    sessionStorageKeys: session.keys,
    storageAccess: {localStorage:local.accessible, sessionStorage:session.accessible},
    globals
  };
})()`;

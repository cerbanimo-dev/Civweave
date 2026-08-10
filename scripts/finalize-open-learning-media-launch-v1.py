#!/usr/bin/env python3
"""Finalize Civweave Open Learning Media launch wiring.

This script is intentionally idempotent. It converts the rights-gated harvest layer into
an installable/offline/mesh-aware runtime without storing audiovisual binaries in Git.
"""
from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"{label}: expected marker not found")
    return text.replace(old, new, 1)


def insert_before(path: str, marker: str, insertion: str) -> None:
    p = Path(path)
    text = p.read_text()
    if insertion.strip() in text:
        return
    if marker not in text:
        raise RuntimeError(f"{path}: insertion marker not found")
    p.write_text(text.replace(marker, insertion + marker, 1))


def wire_surfaces() -> None:
    insert_before(
        "public/app/working-campus-v156.html",
        "</body>",
        '<script src="/app/local-object-mesh-v146.js?v=open-media-cache-v1" defer></script>\n'
        '<script type="module" src="/app/open-learning-media-cache-v1.mjs?v=open-media-cache-v1"></script>\n',
    )
    insert_before(
        "public/app/cabinets/living-school/index.html",
        "  <script type=\"module\">\n  const host=",
        '  <script src="/app/local-object-mesh-v146.js?v=open-media-cache-v1" defer></script>\n'
        '  <script type="module" src="/app/open-learning-media-cache-v1.mjs?v=open-media-cache-v1"></script>\n',
    )
    insert_before(
        "public/app/realm-console-v140.html",
        '<script type="module" src="/app/cerbanimo-video-task-contract-v1.mjs?v=video-atlas-v1"></script>',
        '<script type="module" src="/app/open-learning-media-cache-v1.mjs?v=open-media-cache-v1"></script>\n',
    )


def wire_offline_manifest() -> None:
    path = Path("public/app/offline-package-v208.json")
    data = json.loads(path.read_text())
    data["revision"] = "canonical-background-campus-v241-open-learning-media-v1"
    for asset in [
        "/app/open-learning-media-cache-v1.mjs",
        "/app/open-learning-media-installer-v1.mjs",
        "/downloads/knowledge-schools/open-learning-media/lookup.json",
        "/downloads/knowledge-schools/open-learning-media/harvest-policy.json",
        "/downloads/knowledge-schools/open-learning-media/summary.json",
    ]:
        if asset not in data["assets"]:
            data["assets"].append(asset)
    path.write_text(json.dumps(data, indent=2) + "\n")


def harden_service_worker_core() -> None:
    path = Path("public/service-worker-core-v208.js")
    text = path.read_text()
    text = replace_once(
        text,
        "const FETCH_TIMEOUT_MS = 12000;",
        "const FETCH_TIMEOUT_MS = 12000;\nconst OPEN_MEDIA_ROUTE_PREFIX = '/__civweave_open_media__/';\nconst OPEN_MEDIA_CACHE = 'cw-open-learning-media-v1';",
        "open media route constants",
    )
    if "'/app/open-learning-media-cache-v1.mjs'" not in text:
        marker = "const OPTIONAL_SHELL_ASSETS = [\n  '/app/install-boundary-v146.js',"
        replacement = "const OPTIONAL_SHELL_ASSETS = [\n  '/app/open-learning-media-cache-v1.mjs',\n  '/app/open-learning-media-installer-v1.mjs',\n  '/downloads/knowledge-schools/open-learning-media/lookup.json',\n  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',\n  '/app/install-boundary-v146.js',"
        if marker not in text:
            raise RuntimeError("open media optional shell assets: expected marker not found")
        text = text.replace(marker, replacement, 1)
    text = replace_once(
        text,
        "const PRESERVED_CACHE_PREFIXES = [\n  'cwknowledge-',",
        "const PRESERVED_CACHE_PREFIXES = [\n  'cw-open-learning-media-',\n  'cwknowledge-',",
        "open media cache preservation",
    )
    fetch_marker = "self.addEventListener('fetch', event => {\n  const request = event.request;\n  if (!['GET', 'HEAD'].includes(request.method)) return;\n  const url = new URL(request.url);"
    fetch_with_media = """self.addEventListener('fetch', event => {
  const request = event.request;
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(OPEN_MEDIA_ROUTE_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(OPEN_MEDIA_CACHE);
      const cached = await cache.match(new Request(url.href, { method: 'GET' }));
      if (!cached) return new Response('Open learning media is not cached on this device.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      const baseHeaders = new Headers(cached.headers);
      baseHeaders.set('accept-ranges', 'bytes');
      const range = request.headers.get('range');
      if (request.method === 'HEAD') return new Response(null, { status: cached.status, statusText: cached.statusText, headers: baseHeaders });
      if (!range) return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: baseHeaders });
      const blob = await cached.blob();
      const total = blob.size;
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      const invalid = () => {
        const headers = new Headers(baseHeaders);
        headers.set('content-range', `bytes */${total}`);
        headers.set('content-length', '0');
        return new Response(null, { status: 416, headers });
      };
      if (!match || !total || (!match[1] && !match[2])) return invalid();
      let start;
      let end;
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : total - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= total) return invalid();
      end = Math.min(end, total - 1);
      const partial = blob.slice(start, end + 1, cached.headers.get('content-type') || 'application/octet-stream');
      const headers = new Headers(baseHeaders);
      headers.set('content-range', `bytes ${start}-${end}/${total}`);
      headers.set('content-length', String(partial.size));
      return new Response(partial, { status: 206, headers });
    })());
    return;
  }"""
    text = replace_once(text, fetch_marker, fetch_with_media, "open media cache fetch route")
    path.write_text(text)


def harden_media_runtime() -> None:
    path = Path("public/app/open-learning-media-cache-v1.mjs")
    text = path.read_text()
    text = replace_once(
        text,
        "const AUTOMATIC_ITEM_MAX_BYTES=48*1024*1024;",
        "const AUTOMATIC_ITEM_MAX_BYTES=48*1024*1024;\nconst MIN_RELEVANCE_SCORE=18;",
        "minimum relevance score",
    )
    text = replace_once(
        text,
        "const peerInventory=new Map();\nconst incomingTransfers=new Map();",
        "const peerInventory=new Map();\nconst peerSendChains=new Map();\nconst peerReceiveChains=new Map();\nconst incomingTransfers=new Map();",
        "serialized peer transfer maps",
    )
    text = replace_once(
        text,
        "async function cachedJson(url){if(!globalThis.caches)return null;try{const cache=await caches.open(META_CACHE_NAME);const response=await cache.match(url);return response?.ok?await response.json():null}catch{return null}}",
        "async function cachedJson(url){if(!globalThis.caches)return null;try{const cache=await caches.open(META_CACHE_NAME);let response=await cache.match(url);if(!response)response=await caches.match(url,{ignoreSearch:true});return response?.ok?await response.json():null}catch{return null}}",
        "global offline metadata cache fallback",
    )
    text = replace_once(
        text,
        "export async function effectiveBudgetBytes(){const policy=await storagePolicy();let budget=policy.budgetBytes;try{const estimate=await navigator.storage?.estimate?.();const quota=Number(estimate?.quota)||0;if(quota>0)budget=Math.min(budget,Math.max(64*1024*1024,Math.floor(quota*0.45)))}catch{}return budget}",
        "export async function effectiveBudgetBytes(){const policy=await storagePolicy();let budget=policy.budgetBytes;try{const estimate=await navigator.storage?.estimate?.();const quota=Number(estimate?.quota)||0;if(quota>0)budget=Math.min(budget,Math.max(1,Math.floor(quota*0.45)))}catch{}return budget}",
        "quota bounded storage budget",
    )

    start = text.index("export async function cacheRecord(")
    end = text.index("export async function uncache(", start)
    text = text[:start] + """export async function cacheRecord(record,{automatic=false,pinned=false,force=false}={}){
  await warmup();if(!isRedistributable(record))throw new Error('Media record is not approved for the redistributable cache.');
  const key=recordKey(record),existing=await recordGet(key);if(existing&&!force)return touch(existing);
  const lookup=await loadLookup();if(!catalogFresh(lookup)&&!force)throw new Error('Open Learning Media catalog is stale; refusing a new network download until metadata refreshes.');
  const policy=await storagePolicy();const automaticLimit=Math.min(AUTOMATIC_ITEM_MAX_BYTES,policy.maxAutomaticItemBytes||AUTOMATIC_ITEM_MAX_BYTES);const file=chooseFile(record,{maxBytes:automatic?automaticLimit:Infinity,preferSmall:true});if(!file)throw new Error('No browser-playable direct media file is available.');
  const advertisedBytes=Math.max(0,Number(file.bytes)||0);if(automatic&&advertisedBytes>automaticLimit)throw new Error(`Automatic cache skipped ${bytesLabel(advertisedBytes)} item above the ${bytesLabel(automaticLimit)} per-item cap.`);
  emit('download-start',{recordKey:key,title:record.title,bytes:advertisedBytes,automatic});
  const cache=await mediaCache(),request=syntheticRequest(key);
  try{
    const response=await fetch(file.url,{cache:'no-store'});if(!response.ok||!response.body)throw new Error(`Media origin returned ${response.status}.`);
    const headerBytes=Math.max(0,Number(response.headers.get('content-length'))||0),reserveBytes=Math.max(advertisedBytes,headerBytes);
    if(!reserveBytes)throw new Error('Media origin did not provide a trustworthy file size; refusing unbounded local caching.');
    if(automatic&&reserveBytes>automaticLimit)throw new Error(`Automatic cache skipped ${bytesLabel(reserveBytes)} item above the ${bytesLabel(automaticLimit)} per-item cap.`);
    await ensureRoom(reserveBytes,key);
    const[cacheStream,hashStream]=response.body.tee();const headers=new Headers(response.headers);if(!headers.get('content-type'))headers.set('content-type',fileMime(file));
    const putPromise=cache.put(request,new Response(cacheStream,{status:200,statusText:'OK',headers}));const hashResult=await streamHash(hashStream);await putPromise;
    if(hashResult.bytes>reserveBytes)await ensureRoom(hashResult.bytes,key);
    const stored=normalizedStoredRecord({...record,topicSlug:record.topicSlug},file,hashResult.hash,hashResult.bytes,headers.get('content-type'),{origin:'internet',pinned});await recordPut(stored);emit('download-complete',{recordKey:key,hash:stored.contentHash,bytes:stored.bytes,title:stored.title});announceSoon();return stored;
  }catch(error){await cache.delete(request).catch(()=>false);emit('download-error',{recordKey:key,title:record.title,error:error.message});throw error}
}
""" + text[end:]

    start = text.index("export async function cachedPlayback(")
    end = text.index("function candidatesForQuery(", start)
    text = text[:start] + """export async function cachedPlayback(recordKeyValue){const row=await recordGet(recordKeyValue);if(!row)return null;let url=syntheticRequest(recordKeyValue).url;if(!globalThis.navigator?.serviceWorker?.controller){let blobUrl=objectUrls.get(recordKeyValue);if(!blobUrl){const cache=await mediaCache(),response=await cache.match(syntheticRequest(recordKeyValue));if(!response)return null;blobUrl=URL.createObjectURL(await response.blob());objectUrls.set(recordKeyValue,blobUrl)}url=blobUrl}await touch(row);return{kind:'open-media',url,title:row.title,creator:row.attribution?.creator||'',reason:'Playing from the local Open Learning Media cache.',source:'civweave-open-learning-media-cache',mime:row.mime,local:true,recordKey:row.recordKey,contentHash:row.contentHash,license:row.license,attribution:row.attribution}}
""" + text[end:]

    if "record._score>=MIN_RELEVANCE_SCORE" not in text:
        old = ".filter(record=>isRedistributable(record)).sort((a,b)=>b._score-a._score||Number(b.quality_score||0)-Number(a.quality_score||0))"
        new = ".filter(record=>isRedistributable(record)&&record._score>=MIN_RELEVANCE_SCORE).sort((a,b)=>b._score-a._score||Number(b.quality_score||0)-Number(a.quality_score||0))"
        if old not in text:
            raise RuntimeError("candidate relevance filter marker not found")
        text = text.replace(old, new, 1)
    if "function automaticNetworkAllowed()" not in text:
        marker = "export async function resolveOpenMedia(query,{schoolSlug='',topicSlug='',automaticCache=true}={}){"
        helper = "function automaticNetworkAllowed(){const connection=globalThis.navigator?.connection||globalThis.navigator?.mozConnection||globalThis.navigator?.webkitConnection;return!connection?.saveData&&!['slow-2g','2g'].includes(connection?.effectiveType)}\n"
        if marker not in text:
            raise RuntimeError("resolveOpenMedia marker not found")
        text = text.replace(marker, helper + marker, 1)
    text = text.replace("if(automaticCache){const policy=await storagePolicy();", "if(automaticCache&&automaticNetworkAllowed()){const policy=await storagePolicy();", 1)

    prefetch_marker = "function compactFileBytes(" if "function compactFileBytes(" in text else "export async function prefetchTopic("
    start = text.index(prefetch_marker)
    end = text.index("function safeManifestRecord(", start)
    text = text[:start] + """function compactFileBytes(record){const files=(record?.files||[]).filter(file=>file?.url&&playableFile(file)).map(file=>Number(file?.bytes)||0).filter(bytes=>bytes>0);return files.length?Math.min(...files):Number.MAX_SAFE_INTEGER}
export async function prefetchTopic(topicSlug,{limit=1,pinned=false}={}){const lookup=await loadLookup();const records=(lookup.topics?.[topicSlug]||[]).filter(isRedistributable).map(record=>({...record,topicSlug})).sort((a,b)=>compactFileBytes(a)-compactFileBytes(b)||Number(b.quality_score||0)-Number(a.quality_score||0));const results=[];let successes=0,attempts=0;const maxAttempts=Math.max(6,limit*5);for(const record of records){if(successes>=limit||attempts>=maxAttempts)break;attempts++;try{results.push({ok:true,record:await cacheRecord(record,{automatic:false,pinned})});successes++}catch(error){results.push({ok:false,recordKey:recordKey(record),error:error.message})}}return results}
export async function prefetchFocusPack({limitPerTopic=1,pinned=false}={}){const results={};for(const slug of FOCUS_TOPICS)results[slug]=await prefetchTopic(slug,{limit:limitPerTopic,pinned});return results}
""" + text[end:]

    start = text.index("async function acceptStart(")
    end = text.index("async function finishTransfer(", start)
    text = text[:start] + """async function acceptStart(session,message){const row=message.record||{},peerKey=session.peerId||session.id,manifest=peerInventory.get(peerKey),advertised=manifest?.items?.find?.(entry=>entry.recordKey===row.recordKey&&entry.contentHash===row.contentHash);if(!advertised||!row.recordKey||!row.contentHash||!licenseAllowed(row.license)||clean(advertised.license?.spdx,80).toUpperCase()!==clean(row.license?.spdx,80).toUpperCase()){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:'media manifest or license rejected'});return}const expectedBytes=Math.max(0,Number(row.bytes)||0);if(!expectedBytes||expectedBytes!==Math.max(0,Number(advertised.bytes)||0)){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:'media byte count is missing or does not match the advertised manifest'});return}try{await ensureRoom(expectedBytes,row.recordKey)}catch(error){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:error.message});return}const stream=new TransformStream(),writer=stream.writable.getWriter(),hasher=new Sha256(),cache=await mediaCache(),request=syntheticRequest(row.recordKey);const headers=new Headers({'content-type':row.mime||'application/octet-stream','content-length':String(expectedBytes)});const putPromise=cache.put(request,new Response(stream.readable,{status:200,headers}));incomingTransfers.set(message.transferId,{transferId:message.transferId,sessionId:session.id,record:row,writer,hasher,received:0,putPromise,expectedHash:row.contentHash,expectedBytes,pendingBinary:false});emit('mesh-receive-start',{peerId:session.peerId,recordKey:row.recordKey,bytes:expectedBytes})}
""" + text[end:]

    start = text.index("async function finishTransfer(")
    end = text.index("function resolveTransferWaiter(", start)
    text = text[:start] + """async function finishTransfer(transferId,message){const transfer=incomingTransfers.get(transferId);if(!transfer)return;incomingTransfers.delete(transferId);try{await transfer.writer.close();await transfer.putPromise;if(transfer.received!==transfer.expectedBytes)throw new Error(`Mesh media byte-count verification failed: expected ${transfer.expectedBytes}, received ${transfer.received}.`);const hash=transfer.hasher.digestHex();if(hash!==transfer.expectedHash||hash!==message.contentHash)throw new Error('Mesh media SHA-256 verification failed.');const r=transfer.record;const stored={recordKey:r.recordKey,provider:'mesh',providerId:r.recordKey,topicSlug:r.topicSlug||'',title:r.title||'Open learning media',description:'',sourceUrl:'',fileUrl:'',mime:r.mime||'application/octet-stream',bytes:transfer.received,contentHash:hash,license:r.license,attribution:r.attribution,cachePolicy:'MESH_REDISTRIBUTABLE',qualityScore:0,cachedAt:now(),lastAccessAt:now(),origin:'mesh',pinned:false};await recordPut(stored);emit('mesh-receive-complete',{recordKey:r.recordKey,hash,bytes:transfer.received});resolveTransferWaiter(hash,null,stored);announceSoon()}catch(error){try{const cache=await mediaCache();await cache.delete(syntheticRequest(transfer.record.recordKey))}catch{}resolveTransferWaiter(transfer.expectedHash,error);emit('mesh-receive-error',{recordKey:transfer.record.recordKey,error:error.message})}}
""" + text[end:]

    binary_marker = "async function handleBinary(" if "async function handleBinary(" in text else "function handleBinary("
    start = text.index(binary_marker)
    end = text.index("async function handleMediaMessage(", start)
    text = text[:start] + """async function handleBinary(session,data){for(const transfer of incomingTransfers.values()){if(transfer.sessionId!==session.id||!transfer.pendingBinary)continue;const bytes=data instanceof Uint8Array?data:new Uint8Array(data);transfer.pendingBinary=false;if(transfer.received+bytes.byteLength>transfer.expectedBytes){const error=new Error('Peer sent more media bytes than advertised.');incomingTransfers.delete(transfer.transferId);await transfer.writer.abort(error).catch(()=>{});transfer.putPromise.catch(()=>{});try{const cache=await mediaCache();await cache.delete(syntheticRequest(transfer.record.recordKey))}catch{}resolveTransferWaiter(transfer.expectedHash,error);emit('mesh-receive-error',{recordKey:transfer.record.recordKey,error:error.message});return true}transfer.hasher.update(bytes);transfer.received+=bytes.byteLength;await transfer.writer.write(bytes);return true}return false}
""" + text[end:]
    text = text.replace("if(typeof data!=='string'){handleBinary(session,data);return}", "if(typeof data!=='string'){await handleBinary(session,data);return}", 1)

    old_request = "if(message.type==='cw-media-request'){sendMedia(session,message).catch(error=>sendJson(session.channel,{type:'cw-media-reject',contentHash:message.contentHash,recordKey:message.recordKey,error:error.message}));return}"
    new_request = "if(message.type==='cw-media-request'){const prior=peerSendChains.get(session.id)||Promise.resolve();const next=prior.catch(()=>{}).then(()=>sendMedia(session,message)).catch(error=>sendJson(session.channel,{type:'cw-media-reject',contentHash:message.contentHash,recordKey:message.recordKey,error:error.message})).finally(()=>{if(peerSendChains.get(session.id)===next)peerSendChains.delete(session.id)});peerSendChains.set(session.id,next);return}"
    if old_request in text:
        text = text.replace(old_request, new_request, 1)
    if new_request not in text:
        raise RuntimeError("serialized peer send handler missing")

    old_listener = "channel.addEventListener('message',event=>handleMediaMessage(session,event.data).catch(error=>emit('mesh-protocol-error',{error:error.message})));"
    new_listener = "channel.addEventListener('message',event=>{const prior=peerReceiveChains.get(session.id)||Promise.resolve();const next=prior.catch(()=>{}).then(()=>handleMediaMessage(session,event.data)).catch(error=>emit('mesh-protocol-error',{error:error.message})).finally(()=>{if(peerReceiveChains.get(session.id)===next)peerReceiveChains.delete(session.id)});peerReceiveChains.set(session.id,next)});"
    if old_listener in text:
        text = text.replace(old_listener, new_listener, 1)
    if new_listener not in text:
        raise RuntimeError("serialized peer receive handler missing")

    start = text.index("export async function status()")
    end = text.index("export function subscribe(", start)
    text = text[:start] + """export async function status(){const rows=await recordsAll(),policy=await storagePolicy(),budget=await effectiveBudgetBytes();let lookup=null;try{lookup=await loadLookup()}catch{}let estimate=null,persistentStorage=false;try{estimate=await navigator.storage?.estimate?.();persistentStorage=Boolean(await navigator.storage?.persisted?.())}catch{}return{revision:REVISION,records:rows.length,bytes:rows.reduce((sum,row)=>sum+(Number(row.bytes)||0),0),budgetBytes:budget,policy,quotaBytes:Number(estimate?.quota)||0,usageBytes:Number(estimate?.usage)||0,persistentStorage,catalogBuiltAt:lookup?.built_at||null,catalogFresh:Boolean(lookup&&catalogFresh(lookup)),catalogAgeMs:lookup?catalogAgeMs(lookup):Infinity,minimumRelevanceScore:MIN_RELEVANCE_SCORE,meshPeers:peerInventory.size,meshItems:[...peerInventory.values()].reduce((sum,item)=>sum+(item.items?.length||0),0)}}
""" + text[end:]
    if "POLICY_PRESETS,MIN_RELEVANCE_SCORE,licenseAllowed" not in text:
        text = text.replace("POLICY_PRESETS,licenseAllowed", "POLICY_PRESETS,MIN_RELEVANCE_SCORE,licenseAllowed", 1)
    path.write_text(text)


def harden_video_contract() -> None:
    path = Path("public/app/video-learning-contract-v1.mjs")
    text = path.read_text()
    old = "function allowedExisting(media,availability){if(!media)return false;if(media.kind==='open-media')return Boolean(media.local)||openMedia.licenseAllowed(media.license);if(media.url===FALLBACK_VIDEO_URL||!availability||media.source!=='civweave-video-atlas')return true;return availability.has(youtubeId(media.url))}"
    new = "function allowedExisting(media,availability){if(!media)return false;if(media.kind==='open-media'){if(media.local)return true;if(globalThis.navigator?.onLine===false)return false;return openMedia.licenseAllowed(media.license)}if(media.url===FALLBACK_VIDEO_URL||!availability||media.source!=='civweave-video-atlas')return true;return availability.has(youtubeId(media.url))}"
    text = replace_once(text, old, new, "offline open-media re-resolution")
    path.write_text(text)


def bump_worker_revision() -> None:
    # Force existing installed PWAs to fetch the service-worker core containing the media route.
    path = Path("public/service-worker-v203.js")
    text = path.read_text()
    if "open-learning-media-v1" not in text.splitlines()[0]:
        text = text.replace("local-model-background-v267", "local-model-background-v267 + open-learning-media-v1", 1)
    text = text.replace(
        "importScripts('/service-worker-core-v208.js?v=1.0.62-chat-convergence-v250');",
        "importScripts('/service-worker-core-v208.js?v=1.0.62-chat-convergence-v250-open-learning-media-v1');",
        1,
    )
    path.write_text(text)

    path = Path("public/install-v130.js")
    text = path.read_text().replace(
        "const WORKER_SCRIPT_REVISION = 'release-coherence-v226';",
        "const WORKER_SCRIPT_REVISION = 'open-learning-media-v1';",
        1,
    )
    path.write_text(text)

    path = Path("public/app/installed-entry-v146.js")
    text = path.read_text().replace(
        "&revision=chat-convergence-v250`",
        "&revision=open-learning-media-v1`",
        1,
    )
    path.write_text(text)


def write_durable_workflows() -> None:
    Path(".github/workflows/verify-open-learning-media-v1.yml").write_text("""name: Verify Open Learning Media v1

on:
  push:
    branches: [main, agent/open-learning-media-harvest-v1]
    paths:
      - scripts/harvest-open-learning-media-v1.py
      - scripts/filter-open-learning-media-relevance-v1.py
      - scripts/filter-open-learning-media-pedagogy-v1.py
      - scripts/filter-open-learning-media-selection-v1.py
      - scripts/finalize-open-learning-media-launch-v1.py
      - scripts/test-open-learning-media-harvest-v1.py
      - scripts/test-open-learning-media-runtime-v1.mjs
      - public/app/open-learning-media-cache-v1.mjs
      - public/app/open-learning-media-installer-v1.mjs
      - public/app/video-learning-contract-v1.mjs
      - public/app/video-atlas-installer-v1.js
      - public/app/offline-package-v208.json
      - public/service-worker-core-v208.js
      - public/service-worker-v203.js
      - public/install-v130.js
      - public/app/installed-entry-v146.js
      - public/app/working-campus-v156.html
      - public/app/cabinets/living-school/index.html
      - public/app/realm-console-v140.html
      - public/downloads/knowledge-schools/open-learning-media/**
      - .github/workflows/verify-open-learning-media-v1.yml
  pull_request:
    paths:
      - scripts/harvest-open-learning-media-v1.py
      - scripts/filter-open-learning-media-relevance-v1.py
      - scripts/filter-open-learning-media-pedagogy-v1.py
      - scripts/filter-open-learning-media-selection-v1.py
      - scripts/finalize-open-learning-media-launch-v1.py
      - scripts/test-open-learning-media-harvest-v1.py
      - scripts/test-open-learning-media-runtime-v1.mjs
      - public/app/open-learning-media-cache-v1.mjs
      - public/app/open-learning-media-installer-v1.mjs
      - public/app/video-learning-contract-v1.mjs
      - public/app/video-atlas-installer-v1.js
      - public/app/offline-package-v208.json
      - public/service-worker-core-v208.js
      - public/service-worker-v203.js
      - public/install-v130.js
      - public/app/installed-entry-v146.js
      - public/app/working-campus-v156.html
      - public/app/cabinets/living-school/index.html
      - public/app/realm-console-v140.html
      - public/downloads/knowledge-schools/open-learning-media/**
      - .github/workflows/verify-open-learning-media-v1.yml

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - name: Syntax check service
        run: |
          python -m py_compile scripts/harvest-open-learning-media-v1.py scripts/filter-open-learning-media-relevance-v1.py scripts/filter-open-learning-media-pedagogy-v1.py scripts/filter-open-learning-media-selection-v1.py scripts/finalize-open-learning-media-launch-v1.py scripts/test-open-learning-media-harvest-v1.py
          node --check public/app/open-learning-media-cache-v1.mjs
          node --check public/app/open-learning-media-installer-v1.mjs
          node --check public/app/video-learning-contract-v1.mjs
          node --check scripts/test-open-learning-media-runtime-v1.mjs
      - name: Verify harvested seed contracts
        run: python scripts/test-open-learning-media-harvest-v1.py
      - name: Verify cache mesh and launch wiring
        run: node scripts/test-open-learning-media-runtime-v1.mjs
      - name: Verify required-video compatibility
        run: node scripts/test-video-learning-contract-v1.mjs
""")

    Path(".github/workflows/harvest-open-learning-media-v1.yml").write_text("""name: Harvest Open Learning Media v1

on:
  push:
    branches: [main, agent/open-learning-media-harvest-v1]
    paths:
      - scripts/harvest-open-learning-media-v1.py
      - scripts/filter-open-learning-media-relevance-v1.py
      - scripts/filter-open-learning-media-pedagogy-v1.py
      - scripts/filter-open-learning-media-selection-v1.py
      - .open-learning-media-harvest-trigger
  schedule:
    - cron: '17 5 * * 1'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: open-learning-media-harvest-v1
  cancel-in-progress: true

jobs:
  harvest:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Harvest rights-cleared learning media metadata
        env:
          OPEN_MEDIA_RESULTS_PER_QUERY: '8'
          OPEN_MEDIA_WORKERS: '6'
        run: |
          python scripts/harvest-open-learning-media-v1.py
          python scripts/filter-open-learning-media-relevance-v1.py
          python scripts/filter-open-learning-media-pedagogy-v1.py
          python scripts/filter-open-learning-media-selection-v1.py
      - name: Validate generated catalog
        run: python scripts/test-open-learning-media-harvest-v1.py
      - name: Commit harvested catalog
        run: |
          set -euo pipefail
          git config user.name github-actions[bot]
          git config user.email 41898282+github-actions[bot]@users.noreply.github.com
          git add public/downloads/knowledge-schools/open-learning-media
          if git diff --cached --quiet; then echo 'Harvest produced no catalog diff.'; exit 0; fi
          git commit -m 'Refresh open learning media catalog'
          TARGET_REF="${GITHUB_REF_NAME:-main}"
          git pull --rebase origin "$TARGET_REF"
          git push origin "HEAD:$TARGET_REF"
""")


def package_script() -> None:
    path = Path("package.json")
    data = json.loads(path.read_text())
    data.setdefault("scripts", {})["test:open-learning-media"] = "node scripts/test-open-learning-media-runtime-v1.mjs && python scripts/test-open-learning-media-harvest-v1.py"
    path.write_text(json.dumps(data, indent=2) + "\n")


def main() -> None:
    wire_surfaces()
    wire_offline_manifest()
    harden_service_worker_core()
    harden_media_runtime()
    harden_video_contract()
    bump_worker_revision()
    package_script()
    write_durable_workflows()
    print("Open Learning Media launch finalizer applied successfully.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Apply launch-safety hardening to Civweave Open Learning Media.

Run after the core and range finalizers. This script is idempotent and adds an emergency
rights/provenance revocation lane, peer request binding, bounded peer manifests, URL/MIME
validation, and durable verification wiring.
"""
from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f'{label}: expected marker not found')
    return text.replace(old, new, 1)


def patch_offline_assets() -> None:
    path = Path('public/app/offline-package-v208.json')
    data = json.loads(path.read_text())
    asset = '/downloads/knowledge-schools/open-learning-media/revocations.json'
    if asset not in data['assets']:
        data['assets'].append(asset)
    path.write_text(json.dumps(data, indent=2) + '\n')


def patch_service_worker() -> None:
    path = Path('public/service-worker-core-v208.js')
    text = path.read_text()
    if "'/downloads/knowledge-schools/open-learning-media/revocations.json'" not in text:
        marker = "  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',"
        if marker not in text:
            raise RuntimeError('service worker open-media policy asset marker missing')
        text = text.replace(marker, marker + "\n  '/downloads/knowledge-schools/open-learning-media/revocations.json',", 1)
    path.write_text(text)


def patch_runtime() -> None:
    path = Path('public/app/open-learning-media-cache-v1.mjs')
    text = path.read_text()
    text = replace_once(
        text,
        "const POLICY_URL='/downloads/knowledge-schools/open-learning-media/harvest-policy.json';",
        "const POLICY_URL='/downloads/knowledge-schools/open-learning-media/harvest-policy.json';\nconst REVOCATIONS_URL='/downloads/knowledge-schools/open-learning-media/revocations.json';",
        'revocation URL',
    )
    text = replace_once(
        text,
        'let policyPromise=null;\nlet meshTimer=0;',
        'let policyPromise=null;\nlet revocationsPromise=null;\nlet revokedRecordKeys=new Set();\nlet revokedContentHashes=new Set();\nlet meshTimer=0;\nlet revocationTimer=0;',
        'revocation state',
    )
    if 'export function isRevoked(' not in text:
        marker = 'export function licenseAllowed(license)'
        idx = text.index(marker)
        helper = "export function isRevoked(value={}){const key=typeof value==='string'?clean(value,500):recordKey(value);const hash=typeof value==='object'?clean(value?.contentHash||value?.content_hash,128):'';return Boolean((key&&revokedRecordKeys.has(key))||(hash&&revokedContentHashes.has(hash)))}\n"
        text = text[:idx] + helper + text[idx:]
    text = replace_once(
        text,
        "function isRedistributable(record){return record?.cache_policy==='MESH_REDISTRIBUTABLE'&&licenseAllowed(record?.license)&&Array.isArray(record?.files)&&record.files.length>0}",
        "function isRedistributable(record){return record?.cache_policy==='MESH_REDISTRIBUTABLE'&&licenseAllowed(record?.license)&&!isRevoked(record)&&Array.isArray(record?.files)&&record.files.length>0}",
        'revocation-aware rights gate',
    )
    if 'function safeRemoteUrl(' not in text:
        marker = 'function fileMime(file)'
        idx = text.index(marker)
        helper = "function safeRemoteUrl(value){try{const url=new URL(clean(value,1800));return url.protocol==='https:'?url.href:''}catch{return''}}\n"
        text = text[:idx] + helper + text[idx:]
    text = replace_once(
        text,
        "const files=(Array.isArray(record?.files)?record.files:[]).filter(file=>file?.url&&playableFile(file));",
        "const files=(Array.isArray(record?.files)?record.files:[]).filter(file=>safeRemoteUrl(file?.url)&&playableFile(file));",
        'safe remote media URLs',
    )

    if 'export async function loadRevocations(' not in text:
        start = text.index('export function catalogAgeMs(')
        loader = """export async function loadRevocations({force=false}={}){if(revocationsPromise&&!force)return revocationsPromise;revocationsPromise=(async()=>{let data=null;if(globalThis.navigator?.onLine!==false){try{const network=await fetchJson(REVOCATIONS_URL);if(network?.schema==='civweave.open-learning-media-revocations.v1'){data=network;await cacheJson(REVOCATIONS_URL,network)}}catch{}}if(!data)data=await cachedJson(REVOCATIONS_URL);if(data?.schema!=='civweave.open-learning-media-revocations.v1')data={schema:'civweave.open-learning-media-revocations.v1',record_keys:[],content_hashes:[]};revokedRecordKeys=new Set((data.record_keys||[]).map(value=>clean(value,500)).filter(Boolean));revokedContentHashes=new Set((data.content_hashes||[]).map(value=>clean(value,128).toLowerCase()).filter(value=>/^[a-f0-9]{64}$/.test(value)));emit('revocations-loaded',{recordKeys:revokedRecordKeys.size,contentHashes:revokedContentHashes.size});return data})();return revocationsPromise}\n"""
        text = text[:start] + loader + text[start:]

    # Reject HTML/login/error documents returned with HTTP 200 instead of caching them as video.
    fetch_line = "const response=await fetch(file.url,{cache:'no-store'});if(!response.ok||!response.body)throw new Error(`Media origin returned ${response.status}.`);"
    fetch_hardened = fetch_line + "const originType=clean(response.headers.get('content-type'),160).toLowerCase();if(originType&&!originType.startsWith('video/')&&originType!=='application/octet-stream')throw new Error(`Media origin returned non-video content type ${originType}.`);"
    text = replace_once(text, fetch_line, fetch_hardened, 'origin content-type validation')

    # Revoked cached rows are removed before they can play again.
    cached_old = "export async function cachedPlayback(recordKeyValue){const row=await recordGet(recordKeyValue);if(!row)return null;let url=syntheticRequest(recordKeyValue).url;"
    cached_new = "export async function cachedPlayback(recordKeyValue){const row=await recordGet(recordKeyValue);if(!row)return null;if(isRevoked(row)){await uncache(recordKeyValue);emit('revoked-cache-removed',{recordKey:recordKeyValue,contentHash:row.contentHash});return null}let url=syntheticRequest(recordKeyValue).url;"
    text = replace_once(text, cached_old, cached_new, 'revoked cached playback')

    text = replace_once(
        text,
        "async function localManifest(){return(await recordsAll()).filter(row=>row.contentHash&&licenseAllowed(row.license)&&row.cachePolicy==='MESH_REDISTRIBUTABLE').map(safeManifestRecord)}",
        "async function localManifest(){return(await recordsAll()).filter(row=>row.contentHash&&licenseAllowed(row.license)&&row.cachePolicy==='MESH_REDISTRIBUTABLE'&&!isRevoked(row)).map(safeManifestRecord)}",
        'revocation-aware peer manifest',
    )
    text = replace_once(
        text,
        "if(!row||row.recordKey!==message.recordKey||!licenseAllowed(row.license)||row.cachePolicy!=='MESH_REDISTRIBUTABLE')",
        "if(!row||row.recordKey!==message.recordKey||!licenseAllowed(row.license)||row.cachePolicy!=='MESH_REDISTRIBUTABLE'||isRevoked(row))",
        'revocation-aware peer serving',
    )

    start = text.index('async function acceptStart(')
    end = text.index('async function finishTransfer(', start)
    text = text[:start] + """async function acceptStart(session,message){const row=message.record||{},waiter=transferWaiters.get(clean(row.contentHash,128)),peerKey=session.peerId||session.id,manifest=peerInventory.get(peerKey),advertised=manifest?.items?.find?.(entry=>entry.recordKey===row.recordKey&&entry.contentHash===row.contentHash);if(!waiter||waiter.sessionId!==session.id||waiter.recordKey!==row.recordKey){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:'unsolicited media transfer rejected'});return}const mime=clean(row.mime,160).toLowerCase();if(!advertised||!row.recordKey||!row.contentHash||isRevoked(row)||!licenseAllowed(row.license)||clean(advertised.license?.spdx,80).toUpperCase()!==clean(row.license?.spdx,80).toUpperCase()||(mime&&!mime.startsWith('video/')&&mime!=='application/octet-stream')){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:'media manifest, license, revocation, or MIME rejected'});return}const expectedBytes=Math.max(0,Number(row.bytes)||0);if(!expectedBytes||expectedBytes!==Math.max(0,Number(advertised.bytes)||0)){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:'media byte count is missing or does not match the advertised manifest'});return}try{await ensureRoom(expectedBytes,row.recordKey)}catch(error){sendJson(session.channel,{type:'cw-media-reject',recordKey:row.recordKey,contentHash:row.contentHash,error:error.message});return}const stream=new TransformStream(),writer=stream.writable.getWriter(),hasher=new Sha256(),cache=await mediaCache(),request=syntheticRequest(row.recordKey);const headers=new Headers({'content-type':row.mime||'application/octet-stream','content-length':String(expectedBytes)});const putPromise=cache.put(request,new Response(stream.readable,{status:200,headers}));incomingTransfers.set(message.transferId,{transferId:message.transferId,sessionId:session.id,record:row,writer,hasher,received:0,putPromise,expectedHash:row.contentHash,expectedBytes,pendingBinary:false});emit('mesh-receive-start',{peerId:session.peerId,recordKey:row.recordKey,bytes:expectedBytes})}\n""" + text[end:]

    manifest_old = "peerInventory.set(session.peerId||session.id,{sessionId:session.id,at:now(),items:(message.items||[]).filter(item=>item.recordKey&&item.contentHash&&licenseAllowed(item.license))});"
    manifest_new = "peerInventory.set(session.peerId||session.id,{sessionId:session.id,at:now(),items:(message.items||[]).slice(0,512).filter(item=>item.recordKey&&item.contentHash&&licenseAllowed(item.license)&&!isRevoked(item))});"
    text = replace_once(text, manifest_old, manifest_new, 'bounded peer manifest')

    reject_old = "if(message.type==='cw-media-reject'){resolveTransferWaiter(message.contentHash,new Error(message.error||'Peer rejected media request'));return}"
    reject_new = "if(message.type==='cw-media-reject'){const waiter=transferWaiters.get(message.contentHash);if(waiter?.sessionId===session.id)resolveTransferWaiter(message.contentHash,new Error(message.error||'Peer rejected media request'));return}"
    text = replace_once(text, reject_old, reject_new, 'peer-bound rejection')

    waiter_old = "transferWaiters.set(contentHash,{resolve,reject,timer});sendJson(session.channel,{type:'cw-media-request',contentHash,recordKey:peer.item.recordKey})"
    waiter_new = "transferWaiters.set(contentHash,{resolve,reject,timer,sessionId:session.id,recordKey:peer.item.recordKey});sendJson(session.channel,{type:'cw-media-request',contentHash,recordKey:peer.item.recordKey})"
    text = replace_once(text, waiter_old, waiter_new, 'peer request binding')

    warm_old = 'try{await Promise.all([loadLookup(),loadHarvestPolicy()])}'
    warm_new = 'try{await Promise.all([loadLookup(),loadHarvestPolicy(),loadRevocations()])}'
    text = replace_once(text, warm_old, warm_new, 'revocation warmup')
    if "revocationTimer=setInterval" not in text:
        marker = "if(!meshTimer&&typeof setInterval==='function')meshTimer=setInterval(scanSessions,1000);"
        replacement = marker + "if(!revocationTimer&&typeof setInterval==='function')revocationTimer=setInterval(()=>loadRevocations({force:true}).catch(()=>{}),6*60*60*1000);"
        text = replace_once(text, marker, replacement, 'periodic revocation refresh')

    if 'REVOCATIONS_URL' not in text[text.index('const api=Object.freeze('):]:
        text = text.replace('LOOKUP_URL,POLICY_URL,CACHE_NAME', 'LOOKUP_URL,POLICY_URL,REVOCATIONS_URL,CACHE_NAME', 1)
    if 'loadRevocations,isRevoked' not in text[text.index('const api=Object.freeze('):]:
        text = text.replace('loadLookup,loadHarvestPolicy,catalogFresh', 'loadLookup,loadHarvestPolicy,loadRevocations,isRevoked,catalogFresh', 1)
    path.write_text(text)


def patch_video_contract() -> None:
    path = Path('public/app/video-learning-contract-v1.mjs')
    text = path.read_text()
    if 'function safeExternalUrl(' not in text:
        marker = 'function normalizedMedia(value={}){'
        idx = text.index(marker)
        helper = "function safeExternalUrl(value){try{const url=new URL(clean(value,1800),globalThis.location?.origin||'https://civweave.invalid');return['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}}\nfunction safePlayableUrl(value){try{const url=new URL(clean(value,1800),globalThis.location?.origin||'https://civweave.invalid');if(url.protocol==='https:'||url.protocol==='blob:')return url.href;if(globalThis.location&&url.origin===globalThis.location.origin&&['http:','https:'].includes(url.protocol))return url.href;return''}catch{return''}}\n"
        text = text[:idx] + helper + text[idx:]
    start = text.index('function normalizedMedia(value={}){')
    end = text.index('async function cachedResponse(', start)
    text = text[:start] + """function normalizedMedia(value={}){const raw=clean(typeof value==='string'?value:value?.url||value?.videoUrl,1800);if(!raw)return null;if(isYoutubeUrl(raw))return{kind:'youtube',url:raw,title:clean(value?.title,240)||'Video companion',creator:clean(value?.creator||value?.channel,180),reason:clean(value?.reason||value?.relevance,600),source:clean(value?.source,120)||'generated',score:Number(value?.score)||0};const source=clean(value?.source,160);const open=source.startsWith('civweave-open-learning-media')||value?.kind==='open-media';if(!open)return null;const url=safePlayableUrl(raw);if(!url)return null;return{kind:'open-media',url,title:clean(value?.title,320)||'Open learning media',creator:clean(value?.creator||value?.attribution?.creator,180),reason:clean(value?.reason,600),source:source||'civweave-open-learning-media',score:Number(value?.score)||0,mime:clean(value?.mime,160),local:Boolean(value?.local),recordKey:clean(value?.recordKey,500),contentHash:clean(value?.contentHash,128),license:value?.license||null,attribution:value?.attribution||null,topicSlug:clean(value?.topicSlug,120)}}\n""" + text[end:]
    old = "if(media.attribution?.source_url){const source=document.createElement('a');source.href=media.attribution.source_url;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Source and attribution';section.append(source)}return section;"
    new = "const sourceUrl=safeExternalUrl(media.attribution?.source_url);if(sourceUrl){const source=document.createElement('a');source.href=sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Source and attribution';section.append(source)}return section;"
    text = replace_once(text, old, new, 'safe attribution URL')
    path.write_text(text)


def patch_verify_workflow() -> None:
    path = Path('.github/workflows/verify-open-learning-media-v1.yml')
    text = path.read_text()
    if 'scripts/finalize-open-learning-media-safety-v1.py' not in text:
        marker = '      - scripts/finalize-open-learning-media-launch-v1.py\n'
        if marker in text:
            text = text.replace(marker, marker + '      - scripts/finalize-open-learning-media-range-v1.py\n      - scripts/finalize-open-learning-media-safety-v1.py\n', 1)
    if 'finalize-open-learning-media-range-v1.py scripts/finalize-open-learning-media-safety-v1.py' not in text:
        text = text.replace(
            'scripts/finalize-open-learning-media-launch-v1.py scripts/test-open-learning-media-harvest-v1.py',
            'scripts/finalize-open-learning-media-launch-v1.py scripts/finalize-open-learning-media-range-v1.py scripts/finalize-open-learning-media-safety-v1.py scripts/test-open-learning-media-harvest-v1.py',
            1,
        )
    path.write_text(text)


def main() -> None:
    patch_offline_assets()
    patch_service_worker()
    patch_runtime()
    patch_video_contract()
    patch_verify_workflow()
    print('Open Learning Media launch safety finalizer applied successfully.')


if __name__ == '__main__':
    main()

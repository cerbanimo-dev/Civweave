;(() => {
'use strict';

const V211_REVISION = 'offline-campus-current-graph-v280';
const V211_POLICY = 'resumable-pause-v280';
const V211_REFERENCE_POLICY = 'current-manifest-only-v282';
const V211_SYNC_TAG = 'civweave-campus-resume-v280';
const V211_QUARANTINE_MS = 6 * 60 * 60 * 1000;
const V211_BATCH_SIZE = 16;
const V211_DISCOVERY_TEXT = /\.(?:html?|css|m?js|json|webmanifest|md|txt)$/i;
let v211DownloadPromise = null;
let v211PauseRequested = false;

function v211FailureStatus(error) {
  const direct = Number(error?.status || 0);
  if (direct >= 100 && direct <= 599) return direct;
  const match = String(error?.message || error || '').match(/\breturned\s+(\d{3})\b/i);
  return match ? Number(match[1]) : 0;
}

function v211FailureEntry(entry, fallbackAttempts = 1) {
  const source = entry && typeof entry === 'object' ? entry : {};
  return {
    pathname: String(source.pathname || ''),
    message: String(source.message || 'Unavailable offline-campus dependency.'),
    status: Number(source.status || 0),
    attempts: Math.max(1, Number(source.attempts || fallbackAttempts) || fallbackAttempts),
    required: Boolean(source.required)
  };
}

function v211FailureIsObsolete(entry) {
  const status = Number(entry?.status || 0);
  return status === 404 || status === 410 || (status >= 200 && status < 400);
}

function v211SkippedEntry(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  return {
    pathname: String(source.pathname || ''),
    message: String(source.message || 'Unavailable discovered reference.'),
    status: Number(source.status || 0),
    attempts: Math.max(1, Number(source.attempts || 1) || 1),
    reason: String(source.reason || 'unavailable-discovered-reference'),
    retryAfter: source.retryAfter || new Date(Date.now() + V211_QUARANTINE_MS).toISOString()
  };
}

function v211RequiredSeeds(manifest = {}) {
  return new Set((Array.isArray(manifest.seeds) ? manifest.seeds : []).filter(Boolean));
}

function v211Packet(meta = {}) {
  const assets = [...new Set((Array.isArray(meta.assets) ? meta.assets : []).filter(Boolean))];
  const assetSet = new Set(assets);
  const failed = (Array.isArray(meta.failed) ? meta.failed : []).map(entry => v211FailureEntry(entry));
  const downloadedAssets = [...new Set((Array.isArray(meta.downloadedAssets) ? meta.downloadedAssets : []).filter(pathname => assetSet.has(pathname)))];
  const total = assets.length;
  const attempted = Math.max(0, Math.min(total, Number(meta.attempted ?? meta.completed ?? 0) || 0));
  const downloaded = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Number(
    meta.downloaded ?? meta.successful ?? downloadedAssets.length ?? Math.max(0, attempted - failed.length)
  ) || 0));
  const paused = Boolean(meta.paused);
  const computedReady = !meta.running && !paused && failed.length === 0 && total > 0 && downloaded >= total;
  return {
    type: 'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
    mode: 'resumable-current-campus-graph',
    version: VERSION,
    revision: V211_REVISION,
    policy: V211_POLICY,
    referencePolicy: V211_REFERENCE_POLICY,
    cache: OFFLINE_CACHE,
    ready: Boolean(meta.ready || computedReady) && failed.length === 0 && (!total || downloaded >= total),
    running: Boolean(meta.running) && !paused,
    paused,
    interrupted: Boolean(meta.interrupted),
    resumeSupported: true,
    resumeStrategy: 'per-file-checkpoint',
    syncTag: V211_SYNC_TAG,
    completed: downloaded,
    attempted,
    downloaded,
    successful: downloaded,
    downloadedAssets,
    total,
    discovered: assets.length,
    failed,
    failedCount: failed.length,
    skipped: [],
    skippedCount: 0,
    bytes: Number(meta.bytes || 0),
    updatedAt: meta.updatedAt || null,
    assets
  };
}

async function v211Broadcast(packet) {
  try {
    const windows = await self.clients?.matchAll?.({ type: 'window', includeUncontrolled: true }) || [];
    for (const client of windows) {
      try { client.postMessage(packet); } catch {}
    }
  } catch {}
  return packet;
}

async function v211MigrateMeta(meta, manifest) {
  if (!meta) return null;
  if (meta.revision === V211_REVISION) {
    const packet = v211Packet({ ...meta, skipped: [] });
    const obsoleteCount = Math.max(0, Number(meta.skippedCount || 0), Array.isArray(meta.skipped) ? meta.skipped.length : 0);
    if (obsoleteCount || meta.referencePolicy !== V211_REFERENCE_POLICY || Number(meta.discovered || 0) !== packet.discovered) {
      await writeOfflineMeta({ ...packet, updatedAt: new Date().toISOString() });
    }
    return packet;
  }

  const requiredSeeds = v211RequiredSeeds(manifest);
  const failed = (Array.isArray(meta.failed) ? meta.failed : []).map(entry => v211FailureEntry(entry));
  const requiredFailed = failed.filter(entry => entry.pathname === 'package' || requiredSeeds.has(entry.pathname));
  const optionalFailed = failed.filter(entry => entry.pathname !== 'package' && !requiredSeeds.has(entry.pathname));
  const blockingFailed = requiredFailed;
  const obsoletePaths = new Set([
    ...(Array.isArray(meta.skipped) ? meta.skipped.map(entry => String(entry?.pathname || '')) : []),
    ...optionalFailed.map(entry => entry.pathname)
  ].filter(Boolean));
  const previousAssets = [...new Set((Array.isArray(meta.assets) ? meta.assets : []).filter(pathname => pathname && !obsoletePaths.has(pathname)))];
  const legacyDownloaded = Math.max(0, Number(meta.downloaded ?? meta.successful ?? meta.completed ?? 0) || 0);
  const packet = v211Packet({
    ...meta,
    running: false,
    paused: Boolean(meta.paused),
    interrupted: Boolean(meta.running && !meta.paused),
    ready: false,
    attempted: 0,
    downloaded: Math.min(previousAssets.length, legacyDownloaded),
    total: previousAssets.length,
    assets: previousAssets,
    failed: blockingFailed,
    skipped: [],
    updatedAt: new Date().toISOString()
  });
  await writeOfflineMeta(packet);
  return packet;
}

async function v211SanitizeRetryMeta(meta, manifest) {
  if (!meta) return null;
  const requiredSeeds = v211RequiredSeeds(manifest);
  const failed = (meta.failed || []).map(entry => v211FailureEntry(entry));
  const requiredFailed = failed.filter(entry => entry.pathname === 'package' || requiredSeeds.has(entry.pathname));
  const optionalFailed = failed.filter(entry => entry.pathname !== 'package' && !requiredSeeds.has(entry.pathname));
  const blockingFailed = requiredFailed;
  const obsoletePaths = new Set([
    ...(meta.skipped || []).map(entry => String(entry?.pathname || '')),
    ...optionalFailed.map(entry => entry.pathname)
  ].filter(Boolean));
  if (!obsoletePaths.size) return v211Packet(meta);
  const assets = (meta.assets || []).filter(pathname => !obsoletePaths.has(pathname));
  const downloadedAssets = (meta.downloadedAssets || []).filter(pathname => !obsoletePaths.has(pathname));
  const packet = v211Packet({
    ...meta,
    running: false,
    ready: blockingFailed.length === 0,
    failed: blockingFailed,
    skipped: [],
    assets,
    downloadedAssets,
    total: assets.length,
    updatedAt: new Date().toISOString()
  });
  await writeOfflineMeta(packet);
  return packet;
}

offlinePacket = v211Packet;

offlineStatus = async function offlineStatusV211() {
  const manifest = await loadOfflineManifest().catch(() => ({ seeds: [], assets: [] }));
  const current = await readOfflineMeta();
  if (current) {
    const migrated = await v211MigrateMeta(current, manifest);
    let packet = await v211SanitizeRetryMeta(migrated, manifest);
    if (packet.running && !v211DownloadPromise) {
      packet = v211Packet({
        ...packet,
        running: false,
        paused: false,
        interrupted: true,
        updatedAt: new Date().toISOString()
      });
      await writeOfflineMeta(packet);
    }
    return packet;
  }
  return v211Packet({
    ready: false,
    running: false,
    paused: false,
    interrupted: false,
    attempted: 0,
    downloaded: 0,
    total: manifest.seeds?.length || 0,
    assets: manifest.seeds || [],
    failed: [],
    skipped: [],
    bytes: 0,
    updatedAt: null
  });
};

async function v211DownloadOfflinePackage(event) {
  const manifest = await loadOfflineManifest();
  const previousRaw = await readOfflineMeta();
  const migrated = previousRaw ? await v211MigrateMeta(previousRaw, manifest) : null;
  const previous = migrated ? await v211SanitizeRetryMeta(migrated, manifest) : null;
  const maxAssets = Math.max(50, Math.min(1500, Number(manifest.maxAssets || 700)));
  const maxDepth = Math.max(1, Math.min(12, Number(manifest.maxDepth || 8)));
  const requiredSeeds = v211RequiredSeeds(manifest);
  const skipped = new Map();
  const previousFailures = new Map((previous?.failed || []).map(entry => [entry.pathname, v211FailureEntry(entry)]));
  const sameRelease = previous?.version === VERSION && previous?.revision === V211_REVISION;
  const previousDownloadedAssets = sameRelease ? (previous?.downloadedAssets || []) : [];
  const now = Date.now();
  v211PauseRequested = false;

  const activeSkip = pathname => {
    const entry = skipped.get(pathname);
    if (!entry) return false;
    const retryAt = Date.parse(entry.retryAfter || '');
    if (Number.isFinite(retryAt) && retryAt <= now) {
      skipped.delete(pathname);
      return false;
    }
    return true;
  };

  const initialAssets = [...new Set((manifest.seeds || []).filter(Boolean))];
  for (const asset of (manifest.assets || []).filter(Boolean)) if (!initialAssets.includes(asset)) initialAssets.push(asset);
  const queue = initialAssets.map(pathname => ({ pathname, depth: 0, required: requiredSeeds.has(pathname) }));
  const queued = new Set(initialAssets);
  const processed = new Set();
  const downloaded = new Set(previousDownloadedAssets);
  const failed = new Map();
  let attempted = 0;
  let bytes = 0;

  const progress = async (running = true, ready = false, extra = {}) => {
    const assets = [...queued];
    const downloadedAssets = assets.filter(pathname => downloaded.has(pathname));
    const packet = v211Packet({
      ready,
      running,
      paused: Boolean(extra.paused),
      interrupted: Boolean(extra.interrupted),
      attempted,
      downloaded: downloadedAssets.length,
      downloadedAssets,
      total: assets.length,
      assets,
      failed: [...failed.values()],
      skipped: [...skipped.values()],
      bytes,
      updatedAt: new Date().toISOString()
    });
    await writeOfflineMeta(packet);
    const outbound = { ...packet, type: running ? 'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS' : packet.type };
    post(event, outbound);
    await v211Broadcast(outbound);
    return packet;
  };

  await progress(true, false);

  while (queue.length && processed.size < maxAssets) {
    if (v211PauseRequested) break;
    const batch = queue.splice(0, V211_BATCH_SIZE).filter(item => !processed.has(item.pathname));
    if (!batch.length) continue;
    const results = await Promise.all(batch.map(async item => {
      processed.add(item.pathname);
      attempted += 1;
      try {
        const preferNetwork = !sameRelease && V211_DISCOVERY_TEXT.test(item.pathname);
        const { response, contentLength } = await cacheOfflineAsset(item.pathname, { preferNetwork });
        bytes += contentLength;
        downloaded.add(item.pathname);
        failed.delete(item.pathname);
        skipped.delete(item.pathname);
        const type = String(response.headers.get('content-type') || '');
        let references = [];
        if (item.depth < maxDepth && TEXT_CONTENT.test(type)) {
          const text = await response.clone().text();
          if (text.length <= 4_000_000) references = discoverReferences(text, new URL(item.pathname, self.location.origin), manifest);
        }
        return { item, references };
      } catch (error) {
        downloaded.delete(item.pathname);
        const status = v211FailureStatus(error);
        const prior = previousFailures.get(item.pathname);
        const attempts = Math.max(1, Number(prior?.attempts || 0) + 1);
        const entry = v211FailureEntry({ pathname: item.pathname, message: error?.message || String(error), status, attempts, required: item.required }, attempts);
        if (!item.required) {
          const structural = status >= 200 && status < 400;
          const notFound = status === 404 || status === 410;
          queued.delete(item.pathname);
          failed.delete(item.pathname);
          skipped.set(item.pathname, v211SkippedEntry({
            ...entry,
            reason: notFound ? 'not-found' : structural ? 'invalid-static-response' : 'unavailable-discovered-reference',
            retryAfter: new Date(Date.now() + V211_QUARANTINE_MS).toISOString()
          }));
        } else {
          failed.set(item.pathname, entry);
        }
        return { item, references: [] };
      }
    }));

    for (const result of results) {
      for (const pathname of result.references) {
        if (queued.size >= maxAssets || queued.has(pathname) || activeSkip(pathname)) continue;
        queued.add(pathname);
        queue.push({ pathname, depth: result.item.depth + 1, required: requiredSeeds.has(pathname) });
      }
    }
    if (v211PauseRequested) break;
    await progress(true, false);
  }

  const ready = queue.length === 0 && failed.size === 0;
  const paused = !ready && v211PauseRequested;
  return progress(false, ready, { paused });
}

async function v211FollowActiveDownload(event) {
  const active = v211DownloadPromise;
  if (!active) return null;
  const current = await offlineStatus();
  post(event, { ...current, type: 'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS', running: true, paused: false, joinedExisting: true });
  const finalPacket = await active;
  post(event, finalPacket);
  return finalPacket;
}

downloadOfflinePackage = function downloadOfflinePackageV211(event) {
  if (v211DownloadPromise) return v211FollowActiveDownload(event);
  v211PauseRequested = false;
  v211DownloadPromise = v211DownloadOfflinePackage(event).finally(() => {
    v211DownloadPromise = null;
    v211PauseRequested = false;
  });
  return v211DownloadPromise;
};

self.addEventListener('message', event => {
  if (event.data?.type !== 'PAUSE_OFFLINE_PACKAGE') return;
  v211PauseRequested = true;
  event.waitUntil((async () => {
    const current = await offlineStatus();
    if (!v211DownloadPromise) {
      const packet = v211Packet({ ...current, running: false, paused: true, interrupted: false, updatedAt: new Date().toISOString() });
      await writeOfflineMeta(packet);
      post(event, packet);
      await v211Broadcast(packet);
      return;
    }
    post(event, { ...current, type: 'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS', running: true, paused: false, pauseRequested: true });
  })());
});

self.addEventListener('sync', event => {
  if (event.tag !== V211_SYNC_TAG) return;
  event.waitUntil((async () => {
    const status = await offlineStatus();
    if (status.ready || status.paused || v211DownloadPromise) return status;
    return downloadOfflinePackage(event);
  })());
});

self.CivweaveOfflineCampusV211 = {
  revision: V211_REVISION,
  policy: V211_POLICY,
  referencePolicy: V211_REFERENCE_POLICY,
  syncTag: V211_SYNC_TAG,
  batchSize: V211_BATCH_SIZE,
  currentGraphOnly: true,
  backgroundSafe: true,
  resumablePerFile: true,
  pauseSupported: true,
  resumeSupported: true,
  packet: v211Packet,
  requiredPaths: v211RequiredSeeds,
  requiredSeeds: v211RequiredSeeds,
  failureIsObsolete: v211FailureIsObsolete,
  migrateMeta: v211MigrateMeta,
  sanitizeRetryMeta: v211SanitizeRetryMeta,
  pause() { v211PauseRequested = true; },
  get running() { return Boolean(v211DownloadPromise); }
};

})();
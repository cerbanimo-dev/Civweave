
;(() => {
'use strict';

const V211_REVISION = 'offline-campus-seed-provenance-v211';
const V211_QUARANTINE_MS = 6 * 60 * 60 * 1000;

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

function v211SkippedEntry(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  return {
    pathname: String(source.pathname || ''),
    message: String(source.message || 'Unavailable discovered reference.'),
    status: Number(source.status || 0),
    attempts: Math.max(1, Number(source.attempts || 1) || 1),
    reason: String(source.reason || 'repeated-unavailable'),
    retryAfter: source.retryAfter || new Date(Date.now() + V211_QUARANTINE_MS).toISOString()
  };
}

function v211Packet(meta = {}) {
  const assets = [...new Set((Array.isArray(meta.assets) ? meta.assets : []).filter(Boolean))];
  const failed = (Array.isArray(meta.failed) ? meta.failed : []).map(entry => v211FailureEntry(entry));
  const skipped = (Array.isArray(meta.skipped) ? meta.skipped : []).map(v211SkippedEntry);
  const total = Math.max(0, Number(meta.total ?? assets.length) || 0);
  const attempted = Math.max(0, Number(meta.attempted ?? meta.completed ?? 0) || 0);
  const downloaded = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Number(
    meta.downloaded ?? meta.successful ?? Math.max(0, attempted - failed.length)
  ) || 0));
  return {
    type: 'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
    mode: 'resumable-discovered-campus',
    version: VERSION,
    revision: V211_REVISION,
    cache: OFFLINE_CACHE,
    ready: Boolean(meta.ready) && failed.length === 0 && (!total || downloaded >= total),
    running: Boolean(meta.running),
    completed: downloaded,
    attempted,
    downloaded,
    successful: downloaded,
    total,
    discovered: assets.length + skipped.length,
    failed,
    failedCount: failed.length,
    skipped,
    skippedCount: skipped.length,
    bytes: Number(meta.bytes || 0),
    updatedAt: meta.updatedAt || null,
    assets
  };
}

async function v211MigrateMeta(meta, manifest) {
  if (!meta) return null;
  if (meta.revision === V211_REVISION) return v211Packet(meta);

  const requiredSeeds = new Set((manifest.seeds || []).filter(Boolean));
  const inheritedSkipped = (Array.isArray(meta.skipped) ? meta.skipped : []).map(v211SkippedEntry);
  const failed = (Array.isArray(meta.failed) ? meta.failed : []).map(entry => v211FailureEntry(entry));
  const requiredFailed = failed.filter(entry => entry.pathname === 'package' || requiredSeeds.has(entry.pathname));
  const optionalFailed = failed.filter(entry => entry.pathname !== 'package' && !requiredSeeds.has(entry.pathname));
  const optionalPaths = new Set(optionalFailed.map(entry => entry.pathname));
  const assets = [...new Set((Array.isArray(meta.assets) ? meta.assets : []).filter(pathname => pathname && !optionalPaths.has(pathname)))];
  const skippedByPath = new Map(inheritedSkipped.map(entry => [entry.pathname, entry]));

  for (const entry of optionalFailed) {
    skippedByPath.set(entry.pathname, v211SkippedEntry({
      ...entry,
      reason: entry.status === 404 || entry.status === 410 ? 'not-found' : 'legacy-repeated-unavailable',
      retryAfter: new Date(Date.now() + V211_QUARANTINE_MS).toISOString()
    }));
  }

  const rawAttempted = Math.max(0, Number(meta.attempted ?? meta.completed ?? 0) || 0);
  const legacyDownloaded = Math.max(0, Number(
    meta.downloaded ?? meta.successful ?? Math.max(0, rawAttempted - failed.length)
  ) || 0);
  const downloaded = Math.min(assets.length, legacyDownloaded);
  const packet = v211Packet({
    ...meta,
    running: false,
    ready: requiredFailed.length === 0 && downloaded >= assets.length,
    attempted: Math.min(assets.length, Math.max(downloaded, rawAttempted - optionalFailed.length)),
    downloaded,
    total: assets.length,
    assets,
    failed: requiredFailed,
    skipped: [...skippedByPath.values()],
    updatedAt: new Date().toISOString()
  });
  await writeOfflineMeta(packet);
  return packet;
}

offlinePacket = v211Packet;

offlineStatus = async function offlineStatusV211() {
  const manifest = await loadOfflineManifest().catch(() => ({ seeds: [] }));
  const current = await readOfflineMeta();
  if (current) return v211MigrateMeta(current, manifest);
  return v211Packet({
    ready: false,
    running: false,
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

downloadOfflinePackage = async function downloadOfflinePackageV211(event) {
  const manifest = await loadOfflineManifest();
  const previousRaw = await readOfflineMeta();
  const previous = previousRaw ? await v211MigrateMeta(previousRaw, manifest) : null;
  const maxAssets = Math.max(50, Math.min(1500, Number(manifest.maxAssets || 700)));
  const maxDepth = Math.max(1, Math.min(12, Number(manifest.maxDepth || 8)));
  const requiredSeeds = new Set((manifest.seeds || []).filter(Boolean));
  const skipped = new Map((previous?.skipped || []).map(entry => [entry.pathname, v211SkippedEntry(entry)]));
  const now = Date.now();

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

  const previousAssets = (previous?.assets || []).filter(pathname => pathname && !activeSkip(pathname));
  const initialAssets = [...new Set([...(manifest.seeds || []), ...previousAssets])];
  const queue = initialAssets.map(pathname => ({ pathname, depth: 0, required: requiredSeeds.has(pathname) }));
  const queued = new Set(initialAssets);
  const processed = new Set();
  const downloaded = new Set();
  const previousFailures = new Map((previous?.failed || []).map(entry => [entry.pathname, v211FailureEntry(entry)]));
  const failed = new Map();
  const refreshExisting = previous?.ready === true;
  let attempted = 0;
  let bytes = 0;

  const progress = async (running = true, ready = false) => {
    const assets = [...queued];
    const packet = v211Packet({
      ready,
      running,
      attempted,
      downloaded: downloaded.size,
      total: assets.length,
      assets,
      failed: [...failed.values()],
      skipped: [...skipped.values()],
      bytes,
      updatedAt: new Date().toISOString()
    });
    await writeOfflineMeta(packet);
    post(event, { ...packet, type: running ? 'COMMONWEAVE_OFFLINE_PACKAGE_PROGRESS' : packet.type });
    return packet;
  };

  await progress(true, false);

  while (queue.length && processed.size < maxAssets) {
    const batch = queue.splice(0, 4).filter(item => !processed.has(item.pathname));
    if (!batch.length) continue;
    const results = await Promise.all(batch.map(async item => {
      processed.add(item.pathname);
      attempted += 1;
      try {
        const { response, contentLength } = await cacheOfflineAsset(item.pathname, { preferNetwork: refreshExisting });
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
        const status = v211FailureStatus(error);
        const prior = previousFailures.get(item.pathname);
        const attempts = Math.max(1, Number(prior?.attempts || 0) + 1);
        const entry = v211FailureEntry({
          pathname: item.pathname,
          message: error?.message || String(error),
          status,
          attempts,
          required: item.required
        }, attempts);
        const permanent = status === 404 || status === 410;
        if (!item.required && (permanent || attempts >= 2)) {
          queued.delete(item.pathname);
          failed.delete(item.pathname);
          skipped.set(item.pathname, v211SkippedEntry({
            ...entry,
            reason: permanent ? 'not-found' : 'repeated-unavailable',
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
    await progress(true, false);
  }

  const ready = queue.length === 0 && failed.size === 0;
  return progress(false, ready);
};

self.CommonweaveOfflineCampusV211 = {
  revision: V211_REVISION,
  packet: v211Packet,
  migrateMeta: v211MigrateMeta
};

})();

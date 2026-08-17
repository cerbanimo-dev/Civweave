import {
  isStagingRequest,
  stagingGuild,
} from "../_shared/staging-runtime";

const CORE_DIRECTORY = "https://civweave-core.cerbanimo.workers.dev/api/nodes?limit=100";
const FABRIC_ORIGIN = "https://civweave-node-cloud.cerbanimo.workers.dev";
const STAGING_GUILD_SERVER_ORIGIN = "https://civweave-node-cloud-staging.cerbanimo.workers.dev";
const STAGING_NODE_ID = "civweave-cloud";
const MAX_NODES = 64;
const MAP_CACHE_CONTROL = "public, max-age=15, s-maxage=60, stale-while-revalidate=300";

type JsonRecord = Record<string, any>;

function reply(value: unknown, status = 200, cache = MAP_CACHE_CONTROL) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": cache,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

async function getJson(url: string | URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function safeHttps(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : "";
  } catch {
    return "";
  }
}

function finiteWhole(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function publicRallyPoint(value: JsonRecord) {
  const point = value?.rallyPoint || {};
  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lon);
  if (point?.schema !== "civweave.guild-rally-point.v1") return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  const name = String(point.name || "").trim().slice(0, 180);
  if (!name) return null;
  const precisionMeters = Number(point.precisionMeters ?? point.accuracyMeters);
  return {
    schema: "civweave.guild-rally-point.v1",
    name,
    directions: String(point.directions || "").trim().slice(0, 600) || null,
    latitude,
    longitude,
    precisionMeters: Number.isFinite(precisionMeters) && precisionMeters > 0 ? Math.round(precisionMeters) : null,
    publicPlaceConfirmed: point.publicPlaceConfirmed === true,
    source: String(point.source || "guildkeeper-published-node-manifest").slice(0, 120),
    capturedAt: point.capturedAt || null,
    updatedAt: point.updatedAt || null,
  };
}

function publicLocation(node: JsonRecord) {
  const value = node?.location || node?.publicLocation || node?.metadata?.publicLocation || {};
  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(value.longitude ?? value.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  const precisionMeters = Number(value.precisionMeters ?? value.accuracyMeters);
  const coordinateDecimals = Number(value.coordinateDecimals);
  return {
    schema: "civweave.hub-map-public-location.v1",
    latitude,
    longitude,
    precisionMeters: Number.isFinite(precisionMeters) && precisionMeters > 0 ? Math.round(precisionMeters) : null,
    coordinateDecimals: Number.isSafeInteger(coordinateDecimals) ? coordinateDecimals : null,
    source: String(value.source || "guildkeeper-published-node-manifest").slice(0, 120),
    capturedAt: value.capturedAt || null,
    syncedAt: value.syncedAt || node?.updatedAt || null,
    rallyPoint: publicRallyPoint(value),
  };
}

function stagingLocation(nodeId: string) {
  const guild = stagingGuild(nodeId);
  if (!guild) return null;
  return {
    schema: "civweave.hub-map-public-location.v1",
    latitude: guild.latitude,
    longitude: guild.longitude,
    precisionMeters: 5000,
    coordinateDecimals: 3,
    source: "staging-shadow-location-fallback",
    capturedAt: null,
    syncedAt: null,
    rallyPoint: null,
  };
}

function stagingSlots(guild: NonNullable<ReturnType<typeof stagingGuild>>, capacity: JsonRecord) {
  const remaining = finiteWhole(capacity.totalSeatsRemaining);
  return {
    free: Math.max(0, Math.min(guild.freeSlots, remaining ?? guild.freeSlots)),
    paid: 0,
  };
}

async function liveStagingDirectory() {
  const guild = stagingGuild(STAGING_NODE_ID);
  if (!guild) {
    return reply({
      schema: "civweave.hub-map-directory.v1",
      ok: false,
      environment: "staging",
      error: "staging-guild-not-configured",
      productionMembershipIsolation: true,
      nodes: [],
    }, 500, "no-store");
  }

  // Staging intentionally reads only the one live Guild identity it shadows.
  // Never enumerate production fabric membership or manifests from this path.
  const [directoryResult, manifestResult, stagingCapacityResult] = await Promise.all([
    getJson(CORE_DIRECTORY).catch(() => ({ ok: false, status: 502, payload: {} })),
    getJson(new URL(`/n/${encodeURIComponent(STAGING_NODE_ID)}/api/ai/node/manifest`, FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} })),
    getJson(new URL(`/api/fabric/capacity?nodeId=${encodeURIComponent(STAGING_NODE_ID)}`, STAGING_GUILD_SERVER_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} })),
  ]);

  if (!stagingCapacityResult.ok || stagingCapacityResult.payload?.stagingIsolatedGuildServer !== true) {
    return reply({
      schema: "civweave.hub-map-directory.v1",
      ok: false,
      environment: "staging",
      error: "staging-guild-server-unavailable",
      productionMembershipIsolation: true,
      nodes: [],
    }, 502, "no-store");
  }

  const directory = Array.isArray(directoryResult.payload?.nodes) ? directoryResult.payload.nodes : [];
  const directoryNode = directory.find((node: JsonRecord) => String(node?.nodeId || "").trim() === STAGING_NODE_ID) || {};
  const manifest = manifestResult.ok ? (manifestResult.payload?.manifest || manifestResult.payload || {}) : {};
  const merged: JsonRecord = { ...directoryNode, ...manifest, nodeId: STAGING_NODE_ID };
  const location = publicLocation(merged) || stagingLocation(STAGING_NODE_ID);
  const liveOrigin = safeHttps(merged.publicOrigin) || FABRIC_ORIGIN;

  const nodes = location ? [{
    schema: "civweave.hub-map-node.v1",
    nodeId: STAGING_NODE_ID,
    displayName: guild.displayName || String(merged.displayName || merged.label || STAGING_NODE_ID).slice(0, 180),
    publicOrigin: STAGING_GUILD_SERVER_ORIGIN,
    livePublicOrigin: liveOrigin,
    runtime: String(merged.runtime || "cloudflare-host-node").slice(0, 120),
    status: String(merged.status || "active").slice(0, 40),
    capabilities: Array.isArray(merged.capabilities) ? merged.capabilities.map(String).slice(0, 40) : [],
    location,
    updatedAt: merged.updatedAt || location.syncedAt || null,
    slots: stagingSlots(guild, stagingCapacityResult.payload || {}),
    liveGuild: true,
    stagingShadowSeats: true,
    stagingGuildServerIsolated: true,
    productionMembershipIsolation: true,
  }] : [];

  return reply({
    schema: "civweave.hub-map-directory.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: false,
    stagingShadowSeats: true,
    stagingGuildServerIsolated: true,
    productionMembershipIsolation: true,
    productionDiscoveryReadOnly: true,
    generatedAt: new Date().toISOString(),
    nodes,
    source: {
      directory: directoryResult.ok ? "core-node-directory" : "unavailable",
      guild: manifestResult.ok ? "single-live-guild-manifest" : "unavailable",
      seats: "isolated-staging-guild-server",
    },
    privacy: {
      publicLocationsAreGuildkeeperPublished: true,
      rallyPointsAreGuildkeeperPublished: true,
      roamingDeviceLocationIncluded: false,
      stagingLocationFallbackMayBeUsed: true,
    },
  });
}

async function liveProductionDirectory() {
  const [directoryResult, fabricResult] = await Promise.all([
    getJson(CORE_DIRECTORY).catch(() => ({ ok: false, status: 502, payload: {} })),
    getJson(new URL("/api/fabric/capacity", FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} })),
  ]);

  const directory = Array.isArray(directoryResult.payload?.nodes) ? directoryResult.payload.nodes : [];
  const directoryById = new Map(
    directory
      .filter((node: JsonRecord) => /^[a-z0-9-]{1,120}$/.test(String(node?.nodeId || "")))
      .map((node: JsonRecord) => [String(node.nodeId), node]),
  );
  const registered = [...new Set(
    (Array.isArray(fabricResult.payload?.hostNodeIds) ? fabricResult.payload.hostNodeIds : [])
      .map((value: unknown) => String(value || ""))
      .filter((value: string) => /^[a-z0-9-]{1,120}$/.test(value)),
  )].slice(0, MAX_NODES);

  const manifests = await Promise.all(registered.map(async nodeId => {
    const directoryNode = directoryById.get(nodeId) || {};
    if (publicLocation(directoryNode)) return {};
    const result = await getJson(new URL(`/n/${nodeId}/api/ai/node/manifest`, FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} }));
    return result.ok ? (result.payload?.manifest || result.payload || {}) : {};
  }));

  const nodes = registered.map((nodeId, index) => {
    const merged: JsonRecord = { ...(directoryById.get(nodeId) || {}), ...(manifests[index] || {}), nodeId };
    const liveOrigin = safeHttps(merged.publicOrigin) || FABRIC_ORIGIN;
    const location = publicLocation(merged);
    if (!location) return null;
    return {
      schema: "civweave.hub-map-node.v1",
      nodeId,
      displayName: String(merged.displayName || merged.label || nodeId).slice(0, 180),
      publicOrigin: liveOrigin,
      runtime: String(merged.runtime || "cloudflare-host-node").slice(0, 120),
      status: String(merged.status || "active").slice(0, 40),
      capabilities: Array.isArray(merged.capabilities) ? merged.capabilities.map(String).slice(0, 40) : [],
      location,
      updatedAt: merged.updatedAt || location.syncedAt || null,
    };
  }).filter(Boolean);

  return reply({
    schema: "civweave.hub-map-directory.v1",
    ok: true,
    generatedAt: new Date().toISOString(),
    nodes,
    source: {
      directory: directoryResult.ok ? "core-node-directory" : "unavailable",
      fabric: fabricResult.ok ? "cloudflare-node-fabric" : "unavailable",
    },
    privacy: {
      publicLocationsAreGuildkeeperPublished: true,
      rallyPointsAreGuildkeeperPublished: true,
      roamingDeviceLocationIncluded: false,
    },
  });
}

export const onRequestGet: PagesFunction = async context => {
  const cacheUrl = new URL(context.request.url);
  cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = caches.default;

  const serve = async (builder: () => Promise<Response>) => {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch {
      // Cache availability must never prevent the public Guild Map from loading.
    }

    try {
      const response = await builder();
      if (response.ok && !String(response.headers.get("cache-control") || "").includes("no-store")) {
        context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
      }
      return response;
    } catch (error) {
      return reply({ ok: false, error: "guild-map-directory-failed", message: String((error as Error)?.message || error) }, 502, "no-store");
    }
  };

  if (isStagingRequest(context.request)) {
    return serve(liveStagingDirectory);
  }

  return serve(liveProductionDirectory);
};

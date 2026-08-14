const CORE_DIRECTORY = "https://civweave-core.cerbanimo.workers.dev/api/nodes?limit=100";
const FABRIC_ORIGIN = "https://civweave-node-cloud.cerbanimo.workers.dev";
const MAX_NODES = 64;

type JsonRecord = Record<string, any>;

function reply(value: unknown, status = 200, cache = "public, max-age=30, stale-while-revalidate=120") {
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
    source: String(value.source || "steward-published-node-manifest").slice(0, 120),
    capturedAt: value.capturedAt || null,
    syncedAt: value.syncedAt || node?.updatedAt || null,
  };
}

export const onRequestGet: PagesFunction = async () => {
  try {
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
      const result = await getJson(new URL(`/n/${nodeId}/api/ai/node/manifest`, FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} }));
      return result.ok ? (result.payload?.manifest || result.payload || {}) : {};
    }));

    const nodes = registered.map((nodeId, index) => {
      const merged: JsonRecord = { ...(directoryById.get(nodeId) || {}), ...(manifests[index] || {}), nodeId };
      const location = publicLocation(merged);
      if (!location) return null;
      return {
        schema: "civweave.hub-map-node.v1",
        nodeId,
        displayName: String(merged.displayName || merged.label || nodeId).slice(0, 180),
        publicOrigin: safeHttps(merged.publicOrigin) || FABRIC_ORIGIN,
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
        publicLocationsAreStewardPublished: true,
        roamingDeviceLocationIncluded: false,
      },
    });
  } catch (error) {
    return reply({ ok: false, error: "hub-map-directory-failed", message: String((error as Error)?.message || error) }, 502, "no-store");
  }
};

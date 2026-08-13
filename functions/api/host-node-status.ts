const NODE_DOMAIN = "nodes.commonweave.earth";
const CENTRAL_FABRIC_HOST = "civweave-node-cloud.cerbanimo.workers.dev";
const LEGACY_HOSTS = new Set(["civweave-host-node.onrender.com"]);
const COMMUNITY_SEATS_PER_FREE_NODE = 6;
const SURVIVAL_FLOOR_NEURONS = 25;
const INCLUDED_POOL_BPS = 9_000;

function hostOrigin(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function nodeIdForHost(hostname: string): string | null {
  const match = hostname.toLowerCase().match(/^([a-z0-9-]+)\.nodes\.commonweave\.earth$/);
  return match?.[1] || null;
}

function allowedHost(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return hostname === CENTRAL_FABRIC_HOST || Boolean(nodeIdForHost(hostname)) || LEGACY_HOSTS.has(hostname);
}

function requestedNodeId(value: string | null): string | null {
  const nodeId = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]{1,120}$/.test(nodeId) ? nodeId : null;
}

async function getJson(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function finiteWhole(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function cloudNodeSlots(capacity: Record<string, unknown>) {
  const communitySeatLimit = finiteWhole(capacity.communitySeatLimit) ?? 0;
  const communityMemberCount = finiteWhole(capacity.communityMemberCount) ?? 0;
  const nodeCommunityMembers = finiteWhole(capacity.nodeCommunityMembers) ?? 0;
  const globalCommunityRemaining = Math.max(0, communitySeatLimit - communityMemberCount);
  const freeSlots = capacity.workersPlan === "free"
    ? Math.min(globalCommunityRemaining, Math.max(0, COMMUNITY_SEATS_PER_FREE_NODE - nodeCommunityMembers))
    : globalCommunityRemaining;

  const explicitPaidRemaining = finiteWhole(capacity.paidExpansionSeatsRemaining);
  let paidSlots = explicitPaidRemaining;
  if (paidSlots == null) {
    const dailyCeilingNeurons = finiteWhole(capacity.dailyCeilingNeurons) ?? 0;
    const memberCount = finiteWhole(capacity.memberCount) ?? 0;
    const includedPool = Math.floor(dailyCeilingNeurons * INCLUDED_POOL_BPS / 10_000);
    paidSlots = Math.max(0, Math.floor(includedPool / SURVIVAL_FLOOR_NEURONS) - memberCount);
  }

  return { free: freeSlots, paid: paidSlots };
}

function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export const onRequestGet: PagesFunction = async (context) => {
  const requestUrl = new URL(context.request.url);
  const origin = hostOrigin(requestUrl.searchParams.get("host"));
  if (!origin || !allowedHost(origin)) {
    return reply({ ok: false, error: "host-node-not-allowed" }, 400);
  }

  const centralFabric = origin.hostname.toLowerCase() === CENTRAL_FABRIC_HOST;
  const nodeId = nodeIdForHost(origin.hostname) || (centralFabric ? requestedNodeId(requestUrl.searchParams.get("node")) : null);
  try {
    if (nodeId) {
      const manifestUrl = new URL(centralFabric ? `/n/${nodeId}/api/ai/node/manifest` : "/api/ai/node/manifest", origin);
      const capacityUrl = new URL(centralFabric ? "/api/fabric/capacity" : "/api/ai/node/capacity", origin);
      if (centralFabric) capacityUrl.searchParams.set("nodeId", nodeId);
      const healthUrl = new URL(centralFabric ? `/n/${nodeId}/api/node/health` : "/api/node/health", origin);
      const [manifestResult, capacityResult, healthResult] = await Promise.all([
        getJson(manifestUrl),
        getJson(capacityUrl),
        getJson(healthUrl),
      ]);
      if (!manifestResult.ok || !capacityResult.ok) {
        return reply({
          ok: false,
          error: "host-node-status-unavailable",
          hostOrigin: origin.origin,
          nodeId,
          manifestStatus: manifestResult.status,
          capacityStatus: capacityResult.status,
        }, 502);
      }

      const manifest = manifestResult.payload?.manifest || manifestResult.payload || {};
      const capacity = capacityResult.payload || {};
      return reply({
        schema: "civweave.host-node-status.v1",
        ok: true,
        kind: "cloudflare-capacity-host",
        hostOrigin: origin.origin,
        nodeId: String(manifest.nodeId || capacity.nodeId || nodeId),
        displayName: String(manifest.displayName || manifest.nodeId || nodeId),
        runtime: String(manifest.runtime || "cloudflare-host-node"),
        status: String(manifest.status || "active"),
        health: healthResult.ok ? {
          ok: healthResult.payload?.ok === true,
          connections: finiteWhole(healthResult.payload?.connections),
          updatedAt: healthResult.payload?.updatedAt || manifest.updatedAt || null,
        } : { ok: false, connections: null, updatedAt: manifest.updatedAt || null },
        slots: cloudNodeSlots(capacity),
        capacityAvailable: true,
        capacity: {
          workersPlan: capacity.workersPlan || null,
          nodeMembers: finiteWhole(capacity.nodeMembers),
          nodeCommunityMembers: finiteWhole(capacity.nodeCommunityMembers),
          activePaidMembers: finiteWhole(capacity.activePaidMembers),
          includedDailyNeurons: finiteWhole(capacity.includedDailyNeurons),
          dailyRemainingNeurons: finiteWhole(capacity.dailyRemainingNeurons),
        },
      });
    }

    const [healthResult, configResult] = await Promise.all([
      getJson(new URL("/api/health", origin)),
      getJson(new URL("/api/config", origin)),
    ]);
    if (!healthResult.ok && !configResult.ok) {
      return reply({
        ok: false,
        error: "legacy-host-status-unavailable",
        hostOrigin: origin.origin,
        healthStatus: healthResult.status,
        configStatus: configResult.status,
      }, 502);
    }
    const health = healthResult.payload || {};
    const config = configResult.payload || {};
    return reply({
      schema: "civweave.host-node-status.v1",
      ok: true,
      kind: "legacy-host",
      hostOrigin: origin.origin,
      nodeId: null,
      displayName: String(config.name || health.name || "Civweave Host Node"),
      runtime: String(config.build || health.build || "legacy-host-node"),
      status: "online",
      slots: null,
      capacityAvailable: false,
      capacityMessage: "This host is online but does not publish resident capacity yet.",
    });
  } catch (error) {
    return reply({
      ok: false,
      error: "host-node-status-fetch-failed",
      hostOrigin: origin.origin,
      message: String((error as Error)?.message || error),
    }, 502);
  }
};

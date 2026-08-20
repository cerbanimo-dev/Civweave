import {
  isStagingRequest,
  requestOrigin,
  stagingGuild,
  stagingProductionTargetBlocked,
} from "../_shared/staging-runtime";

const NODE_DOMAIN = "nodes.commonweave.earth";
const CENTRAL_FABRIC_HOST = "civweave-node-cloud.cerbanimo.workers.dev";
const CORE_DIRECTORY = "https://civweave-core.cerbanimo.workers.dev/api/nodes?limit=100";
const STAGING_CORE_DIRECTORY = "https://civweave-core-staging.cerbanimo.workers.dev/api/nodes?limit=100";
const STAGING_GUILD_SERVER_ORIGIN = "https://civweave-node-cloud-staging.cerbanimo.workers.dev";
const LEGACY_HOSTS = new Set(["civweave-host-node.onrender.com"]);
const COMMUNITY_SEATS_PER_FREE_NODE = 6;
const SURVIVAL_FLOOR_NEURONS = 25;
const INCLUDED_POOL_BPS = 9_000;

type JsonRecord = Record<string, any>;

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

async function getJson(url: URL | string) {
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

function safeHttpsOrigin(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : "";
  } catch {
    return "";
  }
}

async function directoryMobileGuild(directoryUrl: string, nodeId: string | null, origin: string) {
  if (!nodeId || !origin) return null;
  const directory = await getJson(directoryUrl).catch(() => ({ ok: false, status: 502, payload: {} }));
  if (!directory.ok) return null;
  const rows = Array.isArray(directory.payload?.nodes) ? directory.payload.nodes : [];
  const row = rows.find((candidate: JsonRecord) => String(candidate?.nodeId || "") === nodeId);
  if (!row || String(row.runtime || "") !== "cloudflare-mobile-guild-edge") return null;
  const capabilities = Array.isArray(row.capabilities) ? row.capabilities.map(String) : [];
  if (!capabilities.includes("public-guild-directory") || safeHttpsOrigin(row.publicOrigin) !== origin) return null;
  return row;
}

async function mobileGuildStatus(target: URL, nodeId: string, directoryRow: JsonRecord, extra: JsonRecord = {}) {
  try {
    const [statusResult, capacityResult] = await Promise.all([
      getJson(new URL("/api/guild/status", target)),
      getJson(new URL("/api/fabric/capacity", target)),
    ]);
    const status = statusResult.payload || {}, capacity = capacityResult.payload || {};
    if (!statusResult.ok || status?.ok !== true || status?.claimed !== true || String(status.guildId || "") !== nodeId) {
      return reply({ ok: false, error: "mobile-guild-status-unavailable", hostOrigin: target.origin, nodeId, guildStatus: statusResult.status, ...extra }, 502);
    }
    if (!capacityResult.ok || capacity?.status !== "ready" || !Array.isArray(capacity?.starterNodes) || capacity.starterNodes.length < 3) {
      return reply({ ok: false, error: "mobile-guild-fabric-unavailable", hostOrigin: target.origin, nodeId, capacityStatus: capacityResult.status, ...extra }, 502);
    }
    return reply({
      schema: "civweave.host-node-status.v1",
      ok: true,
      kind: "cloudflare-mobile-guild-edge",
      hostOrigin: target.origin,
      nodeId,
      displayName: String(status.displayName || directoryRow.displayName || nodeId),
      runtime: "cloudflare-mobile-guild-edge",
      status: "online",
      health: { ok: true, connections: null, updatedAt: status.updatedAt || capacity.updatedAt || directoryRow.updatedAt || null },
      slots: null,
      capacityAvailable: false,
      capacityMessage: "This Mobile Guild is online and discoverable. Its current Worker does not publish Citizen/Patron seat accounting yet, so Civweave will not invent slot numbers.",
      publicMobileGuild: true,
      starterNodeCount: capacity.starterNodes.length,
      aiEnabled: capacity.aiEnabled === true,
      ...extra,
    });
  } catch (error) {
    return reply({ ok: false, error: "mobile-guild-status-fetch-failed", hostOrigin: target.origin, nodeId, message: String((error as Error)?.message || error), ...extra }, 502);
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

async function stagingStatus(request: Request) {
  const requestUrl = new URL(request.url);
  const target = hostOrigin(requestUrl.searchParams.get("host"));
  if (!target) return reply({ ok: false, error: "host-node-not-allowed" }, 400);
  const nodeId = requestedNodeId(requestUrl.searchParams.get("node"));
  const mobile = await directoryMobileGuild(STAGING_CORE_DIRECTORY, nodeId, target.origin);
  if (mobile && nodeId) return mobileGuildStatus(target, nodeId, mobile, { environment: "staging", productionIsolation: true, stagingMobileDirectory: true });

  const pagesOrigin = requestOrigin(request);
  if (target.origin !== pagesOrigin && target.origin !== STAGING_GUILD_SERVER_ORIGIN) {
    return stagingProductionTargetBlocked(request, target.origin);
  }

  const guild = stagingGuild(nodeId);
  if (!guild) return reply({
    ok: false,
    error: "staging-guild-not-found",
    environment: "staging",
    productionIsolation: true,
    nodeId,
  }, 404);

  try {
    const stagingOrigin = new URL(STAGING_GUILD_SERVER_ORIGIN);
    const [manifestResult, capacityResult, healthResult] = await Promise.all([
      getJson(new URL(`/n/${guild.nodeId}/api/ai/node/manifest`, stagingOrigin)),
      getJson(new URL(`/api/fabric/capacity?nodeId=${encodeURIComponent(guild.nodeId)}`, stagingOrigin)),
      getJson(new URL(`/n/${guild.nodeId}/api/node/health`, stagingOrigin)),
    ]);
    if (!manifestResult.ok || !capacityResult.ok || capacityResult.payload?.stagingIsolatedGuildServer !== true) {
      return reply({
        ok: false,
        error: "staging-guild-server-unavailable",
        environment: "staging",
        productionIsolation: true,
        nodeId: guild.nodeId,
        manifestStatus: manifestResult.status,
        capacityStatus: capacityResult.status,
      }, 502);
    }

    const manifest = manifestResult.payload?.manifest || manifestResult.payload || {};
    const capacity = capacityResult.payload || {};
    return reply({
      schema: "civweave.host-node-status.v1",
      ok: true,
      environment: "staging",
      stagingSynthetic: false,
      stagingGuildServerIsolated: true,
      productionIsolation: true,
      kind: "staging-cloudflare-capacity-host",
      hostOrigin: target.origin,
      guildServerOrigin: STAGING_GUILD_SERVER_ORIGIN,
      nodeId: String(manifest.nodeId || capacity.nodeId || guild.nodeId),
      displayName: guild.displayName || String(manifest.displayName || manifest.nodeId || guild.nodeId),
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
  } catch (error) {
    return reply({
      ok: false,
      error: "staging-guild-status-fetch-failed",
      environment: "staging",
      productionIsolation: true,
      nodeId: guild.nodeId,
      message: String((error as Error)?.message || error),
    }, 502);
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  if (isStagingRequest(context.request)) return stagingStatus(context.request);

  const requestUrl = new URL(context.request.url);
  const origin = hostOrigin(requestUrl.searchParams.get("host"));
  const requestedNode = requestedNodeId(requestUrl.searchParams.get("node"));
  if (!origin) return reply({ ok: false, error: "host-node-not-allowed" }, 400);
  const mobile = await directoryMobileGuild(CORE_DIRECTORY, requestedNode, origin.origin);
  if (mobile && requestedNode) return mobileGuildStatus(origin, requestedNode, mobile);
  if (!allowedHost(origin)) return reply({ ok: false, error: "host-node-not-allowed" }, 400);

  const centralFabric = origin.hostname.toLowerCase() === CENTRAL_FABRIC_HOST;
  const nodeId = nodeIdForHost(origin.hostname) || (centralFabric ? requestedNode : null);
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

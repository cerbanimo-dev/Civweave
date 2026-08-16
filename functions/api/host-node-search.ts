import {
  isStagingRequest,
  requestOrigin,
  stagingGuild,
} from "../_shared/staging-runtime";

const CORE_DIRECTORY = "https://civweave-core.cerbanimo.workers.dev/api/nodes?limit=100";
const FABRIC_ORIGIN = "https://civweave-node-cloud.cerbanimo.workers.dev";
const COMMUNITY_SEATS_PER_FREE_NODE = 6;
const SURVIVAL_FLOOR_NEURONS = 25;
const INCLUDED_POOL_BPS = 9_000;
const MAX_CAPACITY_PROBES = 24;
const MAX_RESULTS = 12;

type JsonRecord = Record<string, any>;

function reply(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } });
}

function finiteWhole(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function slotsFor(capacity: JsonRecord) {
  const communitySeatLimit = finiteWhole(capacity.communitySeatLimit) ?? 0;
  const communityMemberCount = finiteWhole(capacity.communityMemberCount) ?? 0;
  const nodeCommunityMembers = finiteWhole(capacity.nodeCommunityMembers) ?? 0;
  const globalCommunityRemaining = Math.max(0, communitySeatLimit - communityMemberCount);
  const free = capacity.workersPlan === "free"
    ? Math.min(globalCommunityRemaining, Math.max(0, COMMUNITY_SEATS_PER_FREE_NODE - nodeCommunityMembers))
    : globalCommunityRemaining;
  const explicitPaid = finiteWhole(capacity.paidExpansionSeatsRemaining);
  const paid = explicitPaid ?? Math.max(0, Math.floor(
    ((finiteWhole(capacity.dailyCeilingNeurons) ?? 0) * INCLUDED_POOL_BPS / 10_000) / SURVIVAL_FLOOR_NEURONS,
  ) - (finiteWhole(capacity.memberCount) ?? 0));
  return { free, paid };
}

function distanceKm(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(targetLatitude - latitude), lonDelta = radians(targetLongitude - longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(targetLatitude)) * Math.sin(lonDelta / 2) ** 2;
  const bounded = Math.max(0, Math.min(1, a));
  return 6371 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

async function getJson(url: string | URL) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function locationFor(node: JsonRecord) {
  const latitude = Number(node?.location?.latitude), longitude = Number(node?.location?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function safeHttps(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : "";
  } catch {
    return "";
  }
}

function matches(mode: string, slots: { free: number; paid: number }) {
  if (mode === "free") return slots.free > 0;
  if (mode === "paid") return slots.paid > 0;
  return slots.free > 0 || slots.paid > 0;
}

async function stagingSearch(request: Request, latitude: number, longitude: number, mode: string) {
  const roundedLatitude = Number(latitude.toFixed(3));
  const roundedLongitude = Number(longitude.toFixed(3));
  const origin = requestOrigin(request);

  const [directory, fabric] = await Promise.all([
    getJson(CORE_DIRECTORY).catch(() => ({ ok: false, status: 502, payload: {} })),
    getJson(new URL("/api/fabric/capacity", FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} })),
  ]);
  if (!fabric.ok) return reply({
    schema: "civweave.nearby-hub-search.v1",
    ok: false,
    environment: "staging",
    error: "live-guild-fabric-unavailable",
    productionMembershipIsolation: true,
    nodes: [],
  }, 502);

  const directoryById = new Map((Array.isArray(directory.payload?.nodes) ? directory.payload.nodes : [])
    .filter((node: JsonRecord) => /^[a-z0-9-]{1,120}$/.test(String(node?.nodeId || "")))
    .map((node: JsonRecord) => [String(node.nodeId), node]));
  const hostNodeIds = [...new Set((Array.isArray(fabric.payload?.hostNodeIds) ? fabric.payload.hostNodeIds : [])
    .map((value: unknown) => String(value || ""))
    .filter((value: string) => /^[a-z0-9-]{1,120}$/.test(value)))].slice(0, MAX_CAPACITY_PROBES);
  const manifests = await Promise.all(hostNodeIds.map(async nodeId => {
    const response = await getJson(new URL(`/n/${nodeId}/api/ai/node/manifest`, FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} }));
    return response.ok ? (response.payload?.manifest || response.payload || {}) : {};
  }));

  const nodes = hostNodeIds.map((nodeId, index) => {
    const guild = stagingGuild(nodeId);
    if (!guild) return null;
    const node: JsonRecord = { ...(directoryById.get(nodeId) || {}), ...(manifests[index] || {}), nodeId };
    const location = locationFor(node) || { latitude: guild.latitude, longitude: guild.longitude };
    const slots = { free: guild.freeSlots, paid: guild.paidSlots };
    if (!matches(mode, slots)) return null;
    return {
      schema: "civweave.nearby-hub.v1",
      nodeId,
      displayName: guild.displayName || String(node.displayName || nodeId).slice(0, 180),
      hostOrigin: origin,
      liveHostOrigin: safeHttps(node.publicOrigin) || FABRIC_ORIGIN,
      runtime: String(node.runtime || "cloudflare-host-node").slice(0, 120),
      status: String(node.status || "active"),
      distanceKm: Number(distanceKm(roundedLatitude, roundedLongitude, location.latitude, location.longitude).toFixed(2)),
      slots,
      liveGuild: true,
      stagingShadowSeats: true,
      productionMembershipIsolation: true,
    };
  }).filter(Boolean)
    .sort((left: any, right: any) => left.distanceKm - right.distanceKm)
    .slice(0, MAX_RESULTS);

  return reply({
    schema: "civweave.nearby-hub-search.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: false,
    stagingShadowSeats: true,
    productionMembershipIsolation: true,
    productionDiscoveryReadOnly: true,
    mode,
    nodes,
    source: {
      directory: directory.ok ? "core-node-directory" : "unavailable",
      fabric: "cloudflare-node-fabric",
      seats: "staging-shadow-overlay",
    },
    privacy: { coordinateDecimals: 3, exactLocationStored: false, exactLocationReturned: false },
  });
}

export const onRequestPost: PagesFunction = async (context) => {
  const contentLength = Number(context.request.headers.get("content-length") || 0);
  if (contentLength > 4_096) return reply({ ok: false, error: "search-request-too-large" }, 413);
  const input = await context.request.json().catch(() => ({})) as JsonRecord;
  const latitude = Number(input.latitude), longitude = Number(input.longitude);
  const mode = ["free", "paid", "both"].includes(String(input.mode)) ? String(input.mode) : "both";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return reply({ ok: false, error: "approximate-location-required" }, 400);
  }

  if (isStagingRequest(context.request)) {
    return stagingSearch(context.request, latitude, longitude, mode);
  }

  const roundedLatitude = Number(latitude.toFixed(3)), roundedLongitude = Number(longitude.toFixed(3));
  try {
    const [directory, fabric] = await Promise.all([
      getJson(CORE_DIRECTORY).catch(() => ({ ok: false, status: 502, payload: {} })),
      getJson(new URL("/api/fabric/capacity", FABRIC_ORIGIN)),
    ]);
    if (!fabric.ok) return reply({ ok: false, error: "hub-fabric-unavailable", fabricStatus: fabric.status }, 502);
    const directoryById = new Map((Array.isArray(directory.payload?.nodes) ? directory.payload.nodes : [])
      .filter((node: JsonRecord) => /^[a-z0-9-]{1,120}$/.test(String(node?.nodeId || "")))
      .map((node: JsonRecord) => [String(node.nodeId), node]));
    const hostNodeIds = [...new Set((Array.isArray(fabric.payload?.hostNodeIds) ? fabric.payload.hostNodeIds : [])
      .map((value: unknown) => String(value || ""))
      .filter((value: string) => /^[a-z0-9-]{1,120}$/.test(value)))].slice(0, MAX_CAPACITY_PROBES);
    const manifests = await Promise.all(hostNodeIds.map(async nodeId => {
      const response = await getJson(new URL(`/n/${nodeId}/api/ai/node/manifest`, FABRIC_ORIGIN)).catch(() => ({ ok: false, status: 502, payload: {} }));
      return response.ok ? (response.payload?.manifest || response.payload || {}) : {};
    }));
    const candidates = hostNodeIds.map((nodeId, index) => {
      const node = { ...(directoryById.get(nodeId) || {}), ...(manifests[index] || {}), nodeId };
      const location = locationFor(node);
      return { ...node, distanceKm: location ? distanceKm(roundedLatitude, roundedLongitude, location.latitude, location.longitude) : null };
    }).filter((node: JsonRecord) => node.status !== "offline")
      .sort((left: JsonRecord, right: JsonRecord) => left.distanceKm == null ? 1 : right.distanceKm == null ? -1 : left.distanceKm - right.distanceKm);
    const probed = await Promise.all(candidates.map(async (node: JsonRecord) => {
      const nodeId = String(node.nodeId), hostOrigin = FABRIC_ORIGIN;
      try {
        const capacityUrl = new URL("/api/fabric/capacity", hostOrigin);capacityUrl.searchParams.set("nodeId", nodeId);
        const capacityResult = await getJson(capacityUrl);
        if (!capacityResult.ok) return null;
        const slots = slotsFor(capacityResult.payload || {});
        if (!matches(mode, slots)) return null;
        return {
          schema: "civweave.nearby-hub.v1",
          nodeId,
          displayName: String(node.displayName || nodeId).slice(0, 180),
          hostOrigin,
          runtime: String(node.runtime || "cloudflare-host-node").slice(0, 120),
          status: String(node.status || "active"),
          distanceKm: node.distanceKm == null ? null : Number(node.distanceKm.toFixed(2)),
          slots,
        };
      } catch {
        return null;
      }
    }));
    return reply({
      schema: "civweave.nearby-hub-search.v1",
      ok: true,
      mode,
      nodes: probed.filter(Boolean).slice(0, MAX_RESULTS),
      privacy: { coordinateDecimals: 3, exactLocationStored: false, exactLocationReturned: false },
    });
  } catch (error) {
    return reply({ ok: false, error: "hub-search-failed", message: String((error as Error)?.message || error) }, 502);
  }
};

export type StagingGuild = {
  nodeId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  freeSlots: number;
  paidSlots: number;
};

export const STAGING_PROJECT_HOST = "civweave-staging.pages.dev";

export const STAGING_GUILDS: readonly StagingGuild[] = Object.freeze([
  Object.freeze({
    nodeId: "staging-guild-north",
    displayName: "North Test Guild",
    latitude: 43.9748,
    longitude: -75.9108,
    freeSlots: 4,
    paidSlots: 12,
  }),
  Object.freeze({
    nodeId: "staging-guild-central",
    displayName: "Central Test Guild",
    latitude: 39.0997,
    longitude: -94.5786,
    freeSlots: 2,
    paidSlots: 18,
  }),
  Object.freeze({
    nodeId: "staging-guild-west",
    displayName: "West Test Guild",
    latitude: 34.0522,
    longitude: -118.2437,
    freeSlots: 5,
    paidSlots: 9,
  }),
]);

export function isStagingRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === STAGING_PROJECT_HOST
    || hostname.endsWith(`.${STAGING_PROJECT_HOST}`)
    || hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]";
}

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function stagingGuild(nodeId: string | null | undefined): StagingGuild | null {
  const wanted = String(nodeId || "").trim().toLowerCase();
  return STAGING_GUILDS.find(guild => guild.nodeId === wanted) || null;
}

export function stagingOnly(request: Request): Response | null {
  if (isStagingRequest(request)) return null;
  return Response.json(
    { ok: false, error: "not-found" },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

export function stagingProductionTargetBlocked(request: Request, target: string): Response {
  return Response.json(
    {
      ok: false,
      error: "staging-production-target-blocked",
      environment: "staging",
      target,
      stagingOrigin: requestOrigin(request),
      productionIsolation: true,
    },
    { status: 409, headers: { "cache-control": "no-store" } },
  );
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function stagingSessionToken(nodeId: string, userId: string): string {
  return `stg.${base64UrlEncode(`${nodeId}\n${userId}`)}`;
}

export function parseStagingSessionToken(token: string | null | undefined): { nodeId: string; userId: string } | null {
  const value = String(token || "").trim();
  if (!value.startsWith("stg.")) return null;
  const decoded = base64UrlDecode(value.slice(4));
  if (!decoded) return null;
  const separator = decoded.indexOf("\n");
  if (separator <= 0) return null;
  const nodeId = decoded.slice(0, separator);
  const userId = decoded.slice(separator + 1);
  if (!stagingGuild(nodeId) || !userId) return null;
  return { nodeId, userId };
}

export function stagingQuota() {
  return {
    includedDailyNeurons: 480,
    includedRemainingNeurons: 480,
    usedNeuronsToday: 0,
    stagingSynthetic: true,
  };
}

export function stagingGuildStatus(guild: StagingGuild, origin: string) {
  return {
    schema: "civweave.host-node-status.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: true,
    productionIsolation: true,
    kind: "staging-fixture-host",
    hostOrigin: origin,
    nodeId: guild.nodeId,
    displayName: guild.displayName,
    runtime: "civweave-staging-pages-fixture",
    status: "active",
    health: {
      ok: true,
      connections: 1,
      updatedAt: new Date().toISOString(),
    },
    slots: { free: guild.freeSlots, paid: guild.paidSlots },
    capacityAvailable: true,
    capacity: {
      workersPlan: "staging",
      nodeMembers: 1,
      nodeCommunityMembers: 1,
      activePaidMembers: 0,
      includedDailyNeurons: 480,
      dailyRemainingNeurons: 480,
    },
  };
}

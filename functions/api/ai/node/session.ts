import {
  parseStagingSessionToken,
  requestOrigin,
  stagingGuild,
  stagingOnly,
  stagingQuota,
  stagingSessionToken,
} from "../../../_shared/staging-runtime";

type JsonRecord = Record<string, unknown>;

function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function nodeIdFrom(request: Request) {
  const url = new URL(request.url);
  return String(
    url.searchParams.get("nodeId")
      || request.headers.get("x-civweave-node-id")
      || "",
  ).trim().toLowerCase();
}

export const onRequestPost: PagesFunction = async context => {
  const blocked = stagingOnly(context.request);
  if (blocked) return blocked;

  const nodeId = nodeIdFrom(context.request);
  const guild = stagingGuild(nodeId);
  if (!guild) return reply({ ok: false, error: "staging-guild-not-found", nodeId }, 404);

  const body = await context.request.json().catch(() => ({})) as JsonRecord;
  const userId = String(body.userId || "").trim().slice(0, 180);
  const credential = String(body.credential || "").trim();
  if (!userId || credential.length < 24) {
    return reply({ ok: false, error: "staging-device-credential-required" }, 400);
  }

  const origin = requestOrigin(context.request);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const quota = stagingQuota();
  return reply({
    schema: "civweave.host-node-login.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: true,
    productionIsolation: true,
    nodeId: guild.nodeId,
    member: {
      nodeId: guild.nodeId,
      userId,
      seatClass: "community",
      billingStatus: "staging",
    },
    quota,
    capacity: {
      nodeId: guild.nodeId,
      workersPlan: "staging",
      synthetic: true,
    },
    capacitySession: {
      nodeId: guild.nodeId,
      userId,
      seatClass: "community",
      origin,
      token: stagingSessionToken(guild.nodeId, userId),
      expiresAt,
    },
  }, 201);
};

export const onRequestGet: PagesFunction = async context => {
  const blocked = stagingOnly(context.request);
  if (blocked) return blocked;

  const authorization = context.request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const session = parseStagingSessionToken(token);
  const nodeId = nodeIdFrom(context.request);
  if (!session || (nodeId && session.nodeId !== nodeId)) {
    return reply({ ok: false, error: "staging-session-invalid" }, 401);
  }

  const guild = stagingGuild(session.nodeId);
  if (!guild) return reply({ ok: false, error: "staging-guild-not-found" }, 404);
  return reply({
    schema: "civweave.host-node-session.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: true,
    productionIsolation: true,
    member: {
      nodeId: guild.nodeId,
      userId: session.userId,
      seatClass: "community",
      billingStatus: "staging",
    },
    capacity: {
      nodeId: guild.nodeId,
      workersPlan: "staging",
      synthetic: true,
    },
    quota: stagingQuota(),
  });
};

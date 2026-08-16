import {
  stagingGuild,
  stagingOnly,
} from "../../../_shared/staging-runtime";

const STAGING_GUILD_SERVER_ORIGIN = "https://civweave-node-cloud-staging.cerbanimo.workers.dev";

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

async function proxySession(request: Request) {
  const blocked = stagingOnly(request);
  if (blocked) return blocked;

  const nodeId = nodeIdFrom(request);
  const guild = stagingGuild(nodeId);
  if (!guild) return reply({ ok: false, error: "staging-guild-not-found", nodeId }, 404);

  const target = new URL("/api/ai/node/session", STAGING_GUILD_SERVER_ORIGIN);
  target.searchParams.set("nodeId", guild.nodeId);
  const headers = new Headers({
    accept: request.headers.get("accept") || "application/json",
    "x-civweave-node-id": guild.nodeId,
  });
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  try {
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("x-civweave-staging-guild-server", "isolated");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return reply({
      ok: false,
      error: "staging-guild-session-proxy-failed",
      environment: "staging",
      productionIsolation: true,
      nodeId: guild.nodeId,
      message: String((error as Error)?.message || error),
    }, 502);
  }
}

export const onRequestPost: PagesFunction = async context => proxySession(context.request);
export const onRequestGet: PagesFunction = async context => proxySession(context.request);

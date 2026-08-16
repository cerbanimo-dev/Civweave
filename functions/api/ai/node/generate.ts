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

export const onRequestPost: PagesFunction = async context => {
  const blocked = stagingOnly(context.request);
  if (blocked) return blocked;

  const nodeId = nodeIdFrom(context.request);
  const guild = stagingGuild(nodeId);
  if (!guild) return reply({ ok: false, error: "staging-guild-not-found", nodeId }, 404);

  const target = new URL("/api/ai/node/generate", STAGING_GUILD_SERVER_ORIGIN);
  target.searchParams.set("nodeId", guild.nodeId);
  const headers = new Headers({
    accept: context.request.headers.get("accept") || "application/json",
    "content-type": context.request.headers.get("content-type") || "application/json",
    "x-civweave-node-id": guild.nodeId,
  });
  const authorization = context.request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: await context.request.arrayBuffer(),
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
      error: "staging-guild-generate-proxy-failed",
      environment: "staging",
      productionIsolation: true,
      nodeId: guild.nodeId,
      message: String((error as Error)?.message || error),
    }, 502);
  }
};

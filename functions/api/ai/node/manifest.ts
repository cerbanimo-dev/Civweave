import { stagingGuild, stagingOnly } from "../../../_shared/staging-runtime";

function reply(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

export const onRequestGet: PagesFunction = async context => {
  const blocked = stagingOnly(context.request);
  if (blocked) return blocked;
  const url = new URL(context.request.url);
  const nodeId = String(url.searchParams.get("nodeId") || context.request.headers.get("x-civweave-node-id") || "").trim().toLowerCase();
  const guild = stagingGuild(nodeId);
  if (!guild) return reply({ ok: false, error: "staging-guild-not-found", nodeId }, 404);
  return reply({
    schema: "civweave.node-manifest.v1",
    environment: "staging",
    stagingSynthetic: true,
    productionIsolation: true,
    manifest: {
      nodeId: guild.nodeId,
      displayName: guild.displayName,
      runtime: "civweave-staging-pages-fixture",
      status: "active",
      capabilities: ["staging-session", "staging-synthetic-ai"],
      updatedAt: new Date().toISOString(),
    },
  });
};

import { stagingGuild, stagingOnly, stagingQuota } from "../../../_shared/staging-runtime";

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
  const quota = stagingQuota();
  return reply({
    schema: "civweave.node-capacity.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: true,
    productionIsolation: true,
    nodeId: guild.nodeId,
    workersPlan: "staging",
    communitySeatLimit: guild.freeSlots + 1,
    communityMemberCount: 1,
    nodeCommunityMembers: 1,
    memberCount: 1,
    activePaidMembers: 0,
    paidExpansionSeatsRemaining: guild.paidSlots,
    includedDailyNeurons: quota.includedDailyNeurons,
    dailyRemainingNeurons: quota.includedRemainingNeurons,
  });
};

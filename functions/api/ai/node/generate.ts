import {
  parseStagingSessionToken,
  stagingGuild,
  stagingOnly,
  stagingQuota,
} from "../../../_shared/staging-runtime";

type JsonRecord = Record<string, any>;

function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function clean(value: unknown, max = 1200) {
  return String(value ?? "").trim().slice(0, max);
}

function lastPrompt(body: JsonRecord) {
  if (Array.isArray(body.messages)) {
    for (let index = body.messages.length - 1; index >= 0; index -= 1) {
      const text = clean(body.messages[index]?.content, 600);
      if (text) return text;
    }
  }
  return clean(body.prompt, 600) || clean(body.system, 600) || "staging route check";
}

export const onRequestPost: PagesFunction = async context => {
  const blocked = stagingOnly(context.request);
  if (blocked) return blocked;

  const authorization = context.request.headers.get("authorization") || "";
  const session = parseStagingSessionToken(authorization.replace(/^Bearer\s+/i, "").trim());
  const url = new URL(context.request.url);
  const requestedNodeId = clean(
    url.searchParams.get("nodeId") || context.request.headers.get("x-civweave-node-id"),
    180,
  ).toLowerCase();
  if (!session || !stagingGuild(session.nodeId) || (requestedNodeId && session.nodeId !== requestedNodeId)) {
    return reply({ ok: false, error: "staging-session-invalid" }, 401);
  }

  const body = await context.request.json().catch(() => ({})) as JsonRecord;
  const prompt = lastPrompt(body);
  const responseFormat = clean(body.responseFormat, 40).toLowerCase();
  const generatedAt = new Date().toISOString();
  const generation = {
    schema: "civweave.generation-provenance.v1",
    kind: "deterministic-generated",
    aiGenerated: false,
    provider: "civweave-staging-synthetic",
    model: "civweave-staging-synthetic",
    requestId: clean(body.requestId, 180),
    purpose: clean(body.purpose || "staging-route-check", 180),
    generatedAt,
  };
  const artifactProvenance = {
    schema: "civweave.content-provenance.v1",
    origin: "deterministic-generated",
    aiGenerated: false,
    createdAt: generatedAt,
    sourceSystem: "civweave-staging-synthetic",
    artifactType: "structured-generation-output",
    generation,
    humanValidations: [],
  };
  const outputJson = responseFormat === "json"
    ? {
        ok: true,
        environment: "staging",
        synthetic: true,
        nodeId: session.nodeId,
        promptReceived: prompt,
        metadata: { civweaveProvenance: artifactProvenance },
      }
    : null;
  const text = outputJson
    ? JSON.stringify(outputJson)
    : `[STAGING] Synthetic AI route verified through ${session.nodeId}. No production model was called. Prompt received: ${prompt}`;
  const quota = { ...stagingQuota(), includedRemainingNeurons: 479, usedNeuronsToday: 1 };

  return reply({
    schema: "civweave.node-ai-generate.v1",
    ok: true,
    environment: "staging",
    stagingSynthetic: true,
    productionIsolation: true,
    nodeId: session.nodeId,
    model: "civweave-staging-synthetic",
    text,
    outputJson,
    metadata: { generation },
    usage: {
      inputTokens: Math.max(1, Math.ceil(prompt.length / 4)),
      outputTokens: Math.max(1, Math.ceil(text.length / 4)),
      chargedNeurons: 1,
      synthetic: true,
    },
    quota,
  });
};
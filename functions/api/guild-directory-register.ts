import { isStagingRequest } from "../_shared/staging-runtime";

const PRODUCTION_CORE = "https://civweave-core.cerbanimo.workers.dev";
const STAGING_CORE = "https://civweave-core-staging.cerbanimo.workers.dev";
const MAX_REGISTRATION_BYTES = 96 * 1024;
const MAX_HISTORICAL_PROOFS = 12;

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

function safeHttpsOrigin(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function signedProof(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function signedProofs(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HISTORICAL_PROOFS).map(signedProof).filter((proof): proof is JsonRecord => Boolean(proof));
}

async function proxyRegistration(coreOrigin: string, publicOrigin: string, proof: JsonRecord | null, historicalProofs: JsonRecord[]) {
  try {
    const response = await fetch(new URL("/api/guild-directory/register", coreOrigin), {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ publicOrigin, ...(proof ? { proof } : {}), ...(historicalProofs.length ? { historicalProofs } : {}) }),
    });
    const payload = await response.json().catch(() => ({}));
    return reply(payload, response.status);
  } catch (error) {
    return reply({ ok: false, error: "guild-directory-registration-unavailable", message: String((error as Error)?.message || error) }, 502);
  }
}

export const onRequestPost: PagesFunction = async context => {
  const contentLength = Number(context.request.headers.get("content-length") || 0);
  if (contentLength > MAX_REGISTRATION_BYTES) return reply({ ok: false, error: "guild-directory-registration-too-large" }, 413);
  const input = await context.request.json().catch(() => ({} as JsonRecord)) as JsonRecord;
  const publicOrigin = safeHttpsOrigin(input.publicOrigin);
  if (!publicOrigin) return reply({ ok: false, error: "A public HTTPS Guild Cloud origin is required." }, 400);
  const proof = signedProof(input.proof);
  const historicalProofs = signedProofs(input.historicalProofs);

  if (isStagingRequest(context.request)) {
    return proxyRegistration(STAGING_CORE, publicOrigin, proof, historicalProofs);
  }
  return proxyRegistration(PRODUCTION_CORE, publicOrigin, proof, historicalProofs);
};

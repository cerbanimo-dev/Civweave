import { isStagingRequest } from "../_shared/staging-runtime";

const PRODUCTION_CORE = "https://civweave-core.cerbanimo.workers.dev";
const STAGING_CORE = "https://civweave-core-staging.cerbanimo.workers.dev";

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

async function proxyRegistration(coreOrigin: string, publicOrigin: string) {
  try {
    const response = await fetch(new URL("/api/guild-directory/register", coreOrigin), {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ publicOrigin }),
    });
    const payload = await response.json().catch(() => ({}));
    return reply(payload, response.status);
  } catch (error) {
    return reply({ ok: false, error: "guild-directory-registration-unavailable", message: String((error as Error)?.message || error) }, 502);
  }
}

export const onRequestPost: PagesFunction = async context => {
  const input = await context.request.json().catch(() => ({} as Record<string, unknown>));
  const publicOrigin = safeHttpsOrigin((input as Record<string, unknown>).publicOrigin);
  if (!publicOrigin) return reply({ ok: false, error: "A public HTTPS Guild Cloud origin is required." }, 400);

  if (isStagingRequest(context.request)) {
    return proxyRegistration(STAGING_CORE, publicOrigin);
  }
  return proxyRegistration(PRODUCTION_CORE, publicOrigin);
};

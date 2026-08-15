import { isStagingRequest, requestOrigin } from "../_shared/staging-runtime";

export const onRequestGet: PagesFunction = async context => {
  const staging = isStagingRequest(context.request);
  return Response.json(
    {
      ok: true,
      service: "civweave-cloudflare-pages",
      environment: staging ? "staging" : "production",
      origin: requestOrigin(context.request),
      productionIsolation: staging,
      stagingSyntheticHub: staging,
      installerStorage: "pages-static-assets",
      installerPath: "/downloads/Civweave-Mobile-Install-Kit.zip",
    },
    { headers: { "cache-control": "no-store" } },
  );
};

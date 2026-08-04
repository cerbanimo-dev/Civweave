interface Env {
  DOWNLOADS: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const installer = await env.DOWNLOADS.head(
    "Commonweave-Mobile-Install-Kit.zip",
  );

  return Response.json(
    {
      ok: true,
      service: "commonweave-cloudflare-pages",
      installerStorage: "r2",
      installerReady: Boolean(installer),
      installerBytes: installer?.size ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
};

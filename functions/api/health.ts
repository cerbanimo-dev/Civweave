export const onRequestGet: PagesFunction = async () => {
  return Response.json(
    {
      ok: true,
      service: "commonweave-cloudflare-pages",
      installerStorage: "pages-static-assets",
      installerPath: "/downloads/Commonweave-Mobile-Install-Kit.zip",
    },
    { headers: { "cache-control": "no-store" } },
  );
};

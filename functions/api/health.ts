export const onRequestGet: PagesFunction = async () => {
  return Response.json(
    {
      ok: true,
      service: "civweave-cloudflare-pages",
      installerStorage: "pages-static-assets",
      installerPath: "/downloads/Civweave-Mobile-Install-Kit.zip",
    },
    { headers: { "cache-control": "no-store" } },
  );
};

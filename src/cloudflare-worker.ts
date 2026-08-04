interface Env {
  ASSETS: Fetcher;
  DOWNLOADS: R2Bucket;
}

const INSTALLER_PATH = "/downloads/Commonweave-Mobile-Install-Kit.zip";
const INSTALLER_KEY = "Commonweave-Mobile-Install-Kit.zip";
const INSTALLER_FILENAME = "Commonweave-Mobile-Install-Kit.zip";

type ParsedRange =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "valid"; offset: number; length: number };

function parseSingleByteRange(value: string | null, size: number): ParsedRange {
  if (!value) {
    return { status: "none" };
  }

  if (!value.startsWith("bytes=") || value.includes(",")) {
    return { status: "invalid" };
  }

  const [startText, endText] = value.slice("bytes=".length).split("-", 2);

  if (startText === "") {
    const suffixLength = Number.parseInt(endText, 10);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { status: "invalid" };
    }

    const length = Math.min(suffixLength, size);
    return {
      status: "valid",
      offset: size - length,
      length,
    };
  }

  const start = Number.parseInt(startText, 10);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
    return { status: "invalid" };
  }

  if (endText === "") {
    return {
      status: "valid",
      offset: start,
      length: size - start,
    };
  }

  const requestedEnd = Number.parseInt(endText, 10);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return { status: "invalid" };
  }

  const end = Math.min(requestedEnd, size - 1);
  return {
    status: "valid",
    offset: start,
    length: end - start + 1,
  };
}

function applyDownloadHeaders(
  headers: Headers,
  object: R2Object,
  contentLength: number,
): void {
  object.writeHttpMetadata(headers);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600");
  headers.set(
    "content-disposition",
    `attachment; filename="${INSTALLER_FILENAME}"`,
  );
  headers.set("content-length", String(contentLength));
  headers.set("content-type", "application/zip");
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
}

async function serveInstaller(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  const metadata = await env.DOWNLOADS.head(INSTALLER_KEY);
  if (!metadata) {
    return Response.json(
      {
        error: "installer_unavailable",
        message:
          "The mobile installer has not been uploaded to the Commonweave R2 bucket yet.",
      },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (request.headers.get("if-none-match") === metadata.httpEtag) {
    return new Response(null, {
      status: 304,
      headers: { etag: metadata.httpEtag },
    });
  }

  const range = parseSingleByteRange(request.headers.get("range"), metadata.size);
  if (range.status === "invalid") {
    return new Response("Requested Range Not Satisfiable", {
      status: 416,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes */${metadata.size}`,
      },
    });
  }

  if (request.method === "HEAD") {
    const headers = new Headers();
    applyDownloadHeaders(headers, metadata, metadata.size);
    return new Response(null, { status: 200, headers });
  }

  const object = await env.DOWNLOADS.get(
    INSTALLER_KEY,
    range.status === "valid"
      ? { range: { offset: range.offset, length: range.length } }
      : undefined,
  );

  if (!object || !("body" in object)) {
    return new Response("Installer unavailable", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  const headers = new Headers();
  const contentLength =
    range.status === "valid" ? range.length : object.size;
  applyDownloadHeaders(headers, object, contentLength);

  if (range.status === "valid") {
    const end = range.offset + range.length - 1;
    headers.set(
      "content-range",
      `bytes ${range.offset}-${end}/${metadata.size}`,
    );
  }

  return new Response(object.body, {
    status: range.status === "valid" ? 206 : 200,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json(
        {
          ok: true,
          service: "commonweave-cloudflare-node",
          mode: "static-mirror",
          installerStorage: "r2",
        },
        {
          headers: { "cache-control": "no-store" },
        },
      );
    }

    if (url.pathname === INSTALLER_PATH) {
      return serveInstaller(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

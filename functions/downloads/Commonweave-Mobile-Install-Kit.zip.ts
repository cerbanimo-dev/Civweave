interface Env {
  DOWNLOADS: R2Bucket;
}

const OBJECT_KEY = "Commonweave-Mobile-Install-Kit.zip";
const DOWNLOAD_NAME = "Commonweave-Mobile-Install-Kit.zip";

type ParsedRange =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "valid"; offset: number; length: number };

function parseRange(value: string | null, size: number): ParsedRange {
  if (!value) return { status: "none" };
  if (!value.startsWith("bytes=") || value.includes(",")) {
    return { status: "invalid" };
  }

  const [startText, endText] = value.slice(6).split("-", 2);
  if (startText === "") {
    const suffix = Number.parseInt(endText, 10);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return { status: "invalid" };
    }
    const length = Math.min(suffix, size);
    return { status: "valid", offset: size - length, length };
  }

  const start = Number.parseInt(startText, 10);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
    return { status: "invalid" };
  }

  if (endText === "") {
    return { status: "valid", offset: start, length: size - start };
  }

  const requestedEnd = Number.parseInt(endText, 10);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return { status: "invalid" };
  }

  const end = Math.min(requestedEnd, size - 1);
  return { status: "valid", offset: start, length: end - start + 1 };
}

function setHeaders(headers: Headers, object: R2Object, length: number): void {
  object.writeHttpMetadata(headers);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600");
  headers.set(
    "content-disposition",
    `attachment; filename="${DOWNLOAD_NAME}"`,
  );
  headers.set("content-length", String(length));
  headers.set("content-type", "application/zip");
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  const metadata = await env.DOWNLOADS.head(OBJECT_KEY);
  if (!metadata) {
    return Response.json(
      {
        error: "installer_unavailable",
        message: "The Commonweave mobile installer has not been uploaded to R2.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  if (request.headers.get("if-none-match") === metadata.httpEtag) {
    return new Response(null, {
      status: 304,
      headers: { etag: metadata.httpEtag },
    });
  }

  const range = parseRange(request.headers.get("range"), metadata.size);
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
    setHeaders(headers, metadata, metadata.size);
    return new Response(null, { status: 200, headers });
  }

  const object = await env.DOWNLOADS.get(
    OBJECT_KEY,
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
  const contentLength = range.status === "valid" ? range.length : object.size;
  setHeaders(headers, object, contentLength);

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
};

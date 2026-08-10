#!/usr/bin/env python3
"""Loopback-only Civweave static server with narrow update/model proxying."""
from __future__ import annotations

import argparse
import http.server
import os
import pathlib
import shutil
import urllib.error
import urllib.parse
import urllib.request

MODEL_PREFIXES = (
    "/app/models/",
    "/app/vendor/transformers/",
)
FORWARDED_HEADERS = {
    "accept",
    "authorization",
    "content-type",
    "x-goog-api-key",
    "x-civweave-hub-token",
}


def safe_local_path(root: pathlib.Path, request_path: str) -> pathlib.Path | None:
    clean = urllib.parse.unquote(urllib.parse.urlsplit(request_path).path)
    relative = clean.lstrip("/")
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate


class CivweaveHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "CivweaveLoopback/1.0"

    def __init__(self, *args, directory: str, source: str, **kwargs):
        self.root = pathlib.Path(directory).resolve()
        self.source = source.rstrip("/")
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        self.send_header("Permissions-Policy", "cross-origin-isolated=(self)")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.fetch_deferred_asset_if_needed()
        super().do_GET()

    def do_HEAD(self) -> None:
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.fetch_deferred_asset_if_needed()
        super().do_HEAD()

    def do_POST(self) -> None:
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.send_error(405)

    def do_DELETE(self) -> None:
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.send_error(405)

    def do_OPTIONS(self) -> None:
        if self.path.startswith("/api/"):
            self.proxy_api()
            return
        self.send_response(204)
        self.end_headers()

    def fetch_deferred_asset_if_needed(self) -> None:
        pathname = urllib.parse.urlsplit(self.path).path
        if not pathname.startswith(MODEL_PREFIXES):
            return
        target = safe_local_path(self.root, pathname)
        if target is None or target.exists():
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(self.source + pathname, headers={"X-Civweave-Package": "mobile-model-on-demand"})
        try:
            with urllib.request.urlopen(request, timeout=300) as response, open(target, "wb") as output:
                shutil.copyfileobj(response, output)
        except Exception:
            target.unlink(missing_ok=True)

    def proxy_api(self) -> None:
        length = int(self.headers.get("content-length", "0") or 0)
        body = self.rfile.read(length) if length else None
        headers = {name: value for name, value in self.headers.items() if name.lower() in FORWARDED_HEADERS}
        request = urllib.request.Request(self.source + self.path, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                payload = response.read()
                self.send_response(response.status)
                for name, value in response.headers.items():
                    if name.lower() not in {"connection", "content-length", "transfer-encoding", "content-encoding"}:
                        self.send_header(name, value)
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(payload)
        except urllib.error.HTTPError as error:
            payload = error.read()
            self.send_response(error.code)
            self.send_header("content-type", error.headers.get("content-type", "application/json; charset=utf-8"))
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)
        except Exception as error:
            payload = (f'{{"error":"Local Civweave proxy failed: {str(error)}"}}').encode()
            self.send_response(502)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--source", required=True)
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()
    os.chdir(root)
    handler = lambda *a, **k: CivweaveHandler(*a, directory=str(root), source=args.source, **k)
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Civweave loopback server: http://{args.host}:{args.port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

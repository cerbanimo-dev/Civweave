#!/usr/bin/env python3
"""Download, verify, and batch-unpack Commonweave category-school seed ZIPs."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

DEFAULT_BASE_URL = "https://commonweave-host-node.onrender.com/downloads/knowledge-schools/"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    root = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if root != target and root not in target.parents:
            raise RuntimeError(f"Unsafe archive path: {member.filename}")
    archive.extractall(destination)


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "CommonweaveKnowledgeSchoolInstaller/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as handle:
            shutil.copyfileobj(response, handle, length=1024 * 1024)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle-dir", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--schools", default="complete-foundations", help="all, a batch name, or comma-separated school slugs")
    parser.add_argument("--base-url", default=None, help=f"Download missing catalog and ZIPs from this URL. Suggested: {DEFAULT_BASE_URL}")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--keep-downloads", action="store_true", help="Keep ZIPs downloaded during this run")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    bundle_dir = args.bundle_dir.resolve()
    bundle_dir.mkdir(parents=True, exist_ok=True)
    catalog_path = bundle_dir / "catalog.json"
    downloaded: list[Path] = []
    if not catalog_path.exists():
        if not args.base_url:
            raise SystemExit(f"Missing {catalog_path}; pass --base-url to download it")
        download(urllib.parse.urljoin(args.base_url.rstrip("/") + "/", "catalog.json"), catalog_path)
        downloaded.append(catalog_path)

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if catalog.get("schema") != "commonweave.knowledge-school-catalog.v1":
        raise RuntimeError("Unsupported knowledge-school catalog schema")
    by_slug = {record["school_slug"]: record for record in catalog["schools"]}
    if args.schools == "all":
        selected = list(by_slug)
    elif args.schools in catalog.get("recommended_batches", {}):
        selected = catalog["recommended_batches"][args.schools]
    else:
        selected = [item.strip() for item in args.schools.split(",") if item.strip()]
    unknown = [slug for slug in selected if slug not in by_slug]
    if unknown:
        raise SystemExit(f"Unknown school slugs: {', '.join(unknown)}")

    destination = args.destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    installed = []
    try:
        for slug in selected:
            record = by_slug[slug]
            archive_path = bundle_dir / record["zip_file"]
            if not archive_path.exists():
                if not args.base_url:
                    raise RuntimeError(f"Missing {archive_path}; pass --base-url to download missing schools")
                url = urllib.parse.urljoin(args.base_url.rstrip("/") + "/", record["zip_file"])
                print(f"downloading {slug} <- {url}")
                download(url, archive_path)
                downloaded.append(archive_path)
            actual_sha = sha256_file(archive_path)
            if actual_sha != record["zip_sha256"]:
                raise RuntimeError(f"Checksum mismatch for {archive_path.name}")
            if archive_path.stat().st_size != int(record["zip_bytes"]):
                raise RuntimeError(f"Size mismatch for {archive_path.name}")
            target = destination / f"commonweave-school-{slug}"
            if target.exists():
                if not args.replace:
                    raise RuntimeError(f"Destination already exists: {target}; pass --replace to overwrite")
                shutil.rmtree(target)
            with zipfile.ZipFile(archive_path) as archive:
                safe_extract(archive, destination)
            installed.append({
                "school_slug": slug,
                "school_name": record["school_name"],
                "path": str(target),
                "zip_sha256": actual_sha,
            })
            print(f"unpacked {slug} -> {target}")
    finally:
        if not args.keep_downloads:
            for path in downloaded:
                if path.name != "catalog.json":
                    path.unlink(missing_ok=True)

    receipt = {
        "catalog_schema": catalog["schema"],
        "catalog_sha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
        "installed": installed,
    }
    (destination / "installed-schools.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

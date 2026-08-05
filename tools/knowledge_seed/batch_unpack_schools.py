#!/usr/bin/env python3
"""Verify and batch-unpack Commonweave category-school seed ZIPs."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle-dir", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--schools", default="all", help="all, a batch name, or comma-separated school slugs")
    parser.add_argument("--replace", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    bundle_dir = args.bundle_dir.resolve()
    catalog = json.loads((bundle_dir / "catalog.json").read_text(encoding="utf-8"))
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
    for slug in selected:
        record = by_slug[slug]
        archive_path = bundle_dir / record["zip_file"]
        actual_sha = sha256_file(archive_path)
        if actual_sha != record["zip_sha256"]:
            raise RuntimeError(f"Checksum mismatch for {archive_path.name}")
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

    receipt = {
        "catalog_schema": catalog["schema"],
        "catalog_database": str(bundle_dir / catalog["catalog_database"]),
        "installed": installed,
    }
    (destination / "installed-schools.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

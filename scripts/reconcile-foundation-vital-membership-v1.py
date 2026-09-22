#!/usr/bin/env python3
"""Replace fetched Level-3 membership with the exact titles already shipped in Foundation.

Vital lists can change after a Foundation release. Expanded must subtract what a device
actually has, not what Level 3 happens to contain on build day. This script extracts
article titles from the provenance manifests inside the committed Foundation ZIPs and
fails closed unless the extracted count matches catalog.json.
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from typing import Any, Iterable

URL_RE = re.compile(r"https?://(?:en\.)?wikipedia\.org/wiki/", re.I)
TITLE_KEYS = ("article_title", "articleTitle", "page_title", "pageTitle", "title", "name")
URL_KEYS = ("canonical_url", "canonicalUrl", "source_url", "sourceUrl", "article_url", "articleUrl", "url")


def clean(value: Any) -> str:
    return " ".join(str(value or "").replace("_", " ").split()).strip()


def title_from_url(value: Any) -> str:
    text = str(value or "").strip()
    if not URL_RE.search(text):
        return ""
    try:
        tail = text.split("/wiki/", 1)[1].split("#", 1)[0].split("?", 1)[0]
    except IndexError:
        return ""
    from urllib.parse import unquote
    return clean(unquote(tail))


def collect(value: Any, out: set[str], depth: int = 0) -> None:
    if value is None or depth > 12:
        return
    if isinstance(value, list):
        for child in value:
            collect(child, out, depth + 1)
        return
    if not isinstance(value, dict):
        return
    title = next((clean(value.get(key)) for key in TITLE_KEYS if clean(value.get(key))), "")
    url = next((str(value.get(key) or "").strip() for key in URL_KEYS if str(value.get(key) or "").strip()), "")
    if title and (URL_RE.search(url) or "article_title" in value or "page_title" in value):
        out.add(title)
    elif url:
        derived = title_from_url(url)
        if derived:
            out.add(derived)
    for child in value.values():
        if isinstance(child, (dict, list)):
            collect(child, out, depth + 1)


def parse_json_bytes(payload: bytes, filename: str, out: set[str]) -> None:
    text = payload.decode("utf-8", errors="replace")
    if filename.lower().endswith((".jsonl", ".ndjson")):
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                collect(json.loads(line), out)
            except json.JSONDecodeError:
                continue
        return
    try:
        collect(json.loads(text), out)
    except json.JSONDecodeError:
        return


def titles_from_zip(path: Path) -> set[str]:
    titles: set[str] = set()
    with zipfile.ZipFile(path) as archive:
        candidates = [
            info for info in archive.infolist()
            if not info.is_dir()
            and info.file_size <= 16 * 1024 * 1024
            and info.filename.lower().endswith((".json", ".jsonl", ".ndjson"))
            and re.search(r"manifest|source|article|provenance|metadata", info.filename, re.I)
        ]
        for info in candidates:
            parse_json_bytes(archive.read(info), info.filename, titles)
    return titles


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--membership", type=Path, required=True)
    parser.add_argument("--foundation-root", type=Path, default=Path("public/downloads/knowledge-schools"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    catalog_path = args.foundation_root / "catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    expected = sum(int(row.get("counts", {}).get("articles", 0)) for row in catalog.get("schools", []))
    if expected <= 0:
        raise RuntimeError("Foundation catalog has no article count.")

    titles: set[str] = set()
    per_school: dict[str, int] = {}
    for school in catalog.get("schools", []):
        zip_path = args.foundation_root / str(school["zip_file"])
        found = titles_from_zip(zip_path)
        expected_school = int(school.get("counts", {}).get("articles", 0))
        if len(found) != expected_school:
            raise RuntimeError(
                f"Could not prove Foundation membership for {school.get('school_slug')}: "
                f"extracted {len(found)} titles but catalog declares {expected_school}."
            )
        overlap = titles.intersection(found)
        if overlap:
            sample = ", ".join(sorted(overlap)[:5])
            raise RuntimeError(f"Foundation title appears in multiple schools: {sample}")
        titles.update(found)
        per_school[str(school.get("school_slug"))] = len(found)

    if len(titles) != expected:
        raise RuntimeError(f"Extracted {len(titles)} Foundation titles but catalog declares {expected}.")

    data = json.loads(args.membership.read_text(encoding="utf-8"))
    if data.get("schema") != "civweave.vital-membership.v1":
        raise RuntimeError("Unexpected Vital membership schema.")
    fetched = list(data.get("levels", {}).get("3", {}).get("articles", []))
    data["levels"]["3"] = {
        "articles": sorted(titles, key=str.casefold),
        "count": len(titles),
        "membership_basis": "shipped-foundation-provenance",
        "fetched_current_level3_count": len(fetched),
    }
    data["foundation_reconciliation"] = {
        "catalog": str(catalog_path),
        "article_count": len(titles),
        "per_school": per_school,
        "reason": "Expanded subtracts the exact shipped Foundation corpus so Vital-list edits cannot create duplicate downloads or gaps.",
    }
    output = args.output or args.membership
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"foundation_titles": len(titles), "fetched_level3_titles": len(fetched), "output": str(output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Compile additive Civweave Expanded/Deep offline knowledge packs.

Inputs are a Vital membership manifest from fetch-vital-memberships-v1.py and one or
more Wikimedia-compatible JSONL/NDJSON/JSONL.GZ or Parquet files. The compiler never
puts the full source corpus in the app: it selects only the required Vital-title deltas,
then writes checksum-addressed, sub-24-MiB ZIP chunks with SQLite + FTS5 and provenance.
"""
from __future__ import annotations

import argparse
import collections
import gzip
import hashlib
import json
import re
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator

SCHEMA = "civweave.knowledge-layer-catalog.v1"
TIER_SCHEMA = "civweave.knowledge-library-tiers.v1"
SCHOOL_NAMES = {
    "people": "School of People and Lives",
    "history": "School of History",
    "geography": "School of Geography",
    "arts": "School of Arts",
    "everyday-life": "School of Everyday Life",
    "philosophy-and-religion": "School of Philosophy and Religion",
    "society-and-social-sciences": "School of Society and Social Sciences",
    "health-medicine-and-disease": "School of Health, Medicine and Disease",
    "science": "School of Science",
    "technology": "School of Technology",
    "mathematics": "School of Mathematics",
}
SCHOOL_ORDER = list(SCHOOL_NAMES)
WORD_RE = re.compile(r"[a-z0-9][a-z0-9'-]{2,}", re.I)
STOP = {
    "the", "and", "for", "with", "from", "into", "that", "this", "are", "was", "were", "has", "have",
    "its", "their", "about", "also", "which", "when", "where", "who", "how", "article", "section", "history",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def title_key(value: object) -> str:
    return " ".join(str(value or "").replace("_", " ").split()).casefold()


def source_paths(inputs: list[Path]) -> list[Path]:
    out: list[Path] = []
    for item in inputs:
        if item.is_dir():
            out.extend(path for path in item.rglob("*") if path.is_file() and supported(path))
        elif item.is_file() and supported(item):
            out.append(item)
        else:
            raise FileNotFoundError(f"Unsupported or missing source: {item}")
    return sorted(set(out))


def supported(path: Path) -> bool:
    name = path.name.lower()
    return name.endswith((".jsonl", ".ndjson", ".jsonl.gz", ".ndjson.gz", ".parquet"))


def json_rows(path: Path) -> Iterator[dict]:
    opener = gzip.open if path.name.lower().endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            if isinstance(value, dict):
                yield value


def parquet_rows(path: Path) -> Iterator[dict]:
    try:
        import pyarrow.parquet as pq  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Parquet input requires pyarrow (`python -m pip install pyarrow`).") from exc
    parquet = pq.ParquetFile(path)
    wanted = [name for name in ("name", "title", "identifier", "id", "url", "abstract", "description", "sections", "license", "version", "text") if name in parquet.schema.names]
    for batch in parquet.iter_batches(batch_size=1024, columns=wanted):
        for row in batch.to_pylist():
            if isinstance(row, dict):
                yield row


def iter_source_rows(paths: list[Path]) -> Iterator[dict]:
    for path in paths:
        yield from (parquet_rows(path) if path.suffix.lower() == ".parquet" else json_rows(path))


def as_json(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        if stripped[:1] in "[{":
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                return value
    return value


def section_rows(value: object) -> list[dict]:
    value = as_json(value)
    rows: list[dict] = []

    def walk(node: object, heading: str = "", depth: int = 0) -> None:
        if depth > 12 or node is None:
            return
        if isinstance(node, list):
            for child in node:
                walk(child, heading, depth + 1)
            return
        if isinstance(node, str):
            text = " ".join(node.split())
            if len(text) >= 40:
                rows.append({"heading": heading or "Article", "text": text, "links": []})
            return
        if not isinstance(node, dict):
            return
        local_heading = str(node.get("name") or node.get("heading") or node.get("title") or heading or "Article").strip()
        value_text = node.get("value") or node.get("text") or node.get("content")
        if isinstance(value_text, str):
            text = " ".join(value_text.split())
            if len(text) >= 40:
                links = node.get("links") if isinstance(node.get("links"), list) else []
                rows.append({"heading": local_heading, "text": text, "links": links})
        for key in ("has_parts", "sections", "children", "parts"):
            if key in node:
                walk(node[key], local_heading, depth + 1)

    walk(value)
    return rows


def normalize_record(row: dict) -> dict | None:
    title = str(row.get("name") or row.get("title") or "").strip()
    if not title:
        return None
    sections = section_rows(row.get("sections"))
    raw_text = row.get("text")
    if not sections and isinstance(raw_text, str) and raw_text.strip():
        sections = [{"heading": "Article", "text": " ".join(raw_text.split()), "links": []}]
    abstract = row.get("abstract")
    if isinstance(abstract, dict):
        abstract = abstract.get("value") or abstract.get("text") or ""
    abstract = " ".join(str(abstract or "").split())
    if abstract and not sections:
        sections = [{"heading": "Abstract", "text": abstract, "links": []}]
    if not sections:
        return None
    license_value = as_json(row.get("license"))
    return {
        "title": title,
        "identifier": str(row.get("identifier") or row.get("id") or ""),
        "url": str(row.get("url") or f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}").strip(),
        "abstract": abstract,
        "description": " ".join(str(row.get("description") or "").split()),
        "license": license_value,
        "version": as_json(row.get("version")),
        "sections": sections,
    }


def load_membership(path: Path) -> tuple[dict[str, dict[str, set[str]]], dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != "civweave.vital-membership.v1":
        raise RuntimeError("Unexpected Vital membership schema.")
    level3 = {title_key(value) for value in data["levels"]["3"]["articles"]}
    level4 = {school: {title_key(value) for value in data["levels"]["4"]["schools"].get(school, [])} for school in SCHOOL_ORDER}
    level5 = {school: {title_key(value) for value in data["levels"]["5"]["schools"].get(school, [])} for school in SCHOOL_ORDER}
    all4 = set().union(*level4.values())
    layers = {
        "expanded": {school: values - level3 for school, values in level4.items()},
        "deep": {school: values - all4 for school, values in level5.items()},
    }
    route: dict[str, str] = {}
    for layer, schools in layers.items():
        for school, titles in schools.items():
            for key in titles:
                route.setdefault(key, f"{layer}\t{school}")
    return layers, route


def spool_selected(paths: list[Path], route: dict[str, str], spool_root: Path) -> tuple[dict[tuple[str, str], int], set[str]]:
    handles: dict[tuple[str, str], object] = {}
    found: set[str] = set()
    counts: collections.Counter[tuple[str, str]] = collections.Counter()
    try:
        for raw in iter_source_rows(paths):
            key = title_key(raw.get("name") or raw.get("title"))
            destination = route.get(key)
            if not destination or key in found:
                continue
            record = normalize_record(raw)
            if not record:
                continue
            layer, school = destination.split("\t", 1)
            slot = (layer, school)
            if slot not in handles:
                path = spool_root / layer / f"{school}.jsonl"
                path.parent.mkdir(parents=True, exist_ok=True)
                handles[slot] = path.open("a", encoding="utf-8")
            handles[slot].write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")  # type: ignore[attr-defined]
            found.add(key)
            counts[slot] += 1
            if len(found) == len(route):
                break
    finally:
        for handle in handles.values():
            handle.close()  # type: ignore[attr-defined]
    return dict(counts), found


def load_spool(path: Path) -> Iterator[dict]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def routing_terms(records: list[dict], limit: int = 1024) -> list[str]:
    counter: collections.Counter[str] = collections.Counter()
    for record in records:
        fields = [record["title"]] + [str(section.get("heading") or "") for section in record["sections"]]
        for field in fields:
            counter.update(token.casefold() for token in WORD_RE.findall(field) if token.casefold() not in STOP)
    return [token for token, _ in counter.most_common(limit)]


def create_database(records: list[dict], path: Path, layer: str, school: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.executescript("""
            PRAGMA journal_mode=OFF;
            PRAGMA synchronous=OFF;
            CREATE TABLE library_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE articles(article_id INTEGER PRIMARY KEY, source_id TEXT, title TEXT NOT NULL, canonical_url TEXT NOT NULL, abstract TEXT, description TEXT, license_json TEXT, version_json TEXT);
            CREATE TABLE sections(section_id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL, ordinal INTEGER NOT NULL, heading TEXT, text TEXT NOT NULL, links_json TEXT, FOREIGN KEY(article_id) REFERENCES articles(article_id));
            CREATE VIRTUAL TABLE sections_fts USING fts5(title, heading, text, canonical_url UNINDEXED, tokenize='unicode61');
            CREATE INDEX sections_article_idx ON sections(article_id, ordinal);
        """)
        connection.executemany("INSERT INTO library_meta(key,value) VALUES(?,?)", [("schema", "civweave.knowledge-layer-sqlite.v1"), ("layer", layer), ("school_slug", school)])
        for article_id, record in enumerate(records, 1):
            connection.execute("INSERT INTO articles VALUES(?,?,?,?,?,?,?,?)", (article_id, record["identifier"], record["title"], record["url"], record["abstract"], record["description"], json.dumps(record["license"], ensure_ascii=False), json.dumps(record["version"], ensure_ascii=False)))
            for ordinal, section in enumerate(record["sections"]):
                connection.execute("INSERT INTO sections(article_id,ordinal,heading,text,links_json) VALUES(?,?,?,?,?)", (article_id, ordinal, section.get("heading", ""), section.get("text", ""), json.dumps(section.get("links", []), ensure_ascii=False)))
                connection.execute("INSERT INTO sections_fts(title,heading,text,canonical_url) VALUES(?,?,?,?)", (record["title"], section.get("heading", ""), section.get("text", ""), record["url"]))
        connection.commit()
        connection.execute("VACUUM")
    finally:
        connection.close()


def write_pack(records: list[dict], out_dir: Path, layer: str, school: str, sequence: int, max_zip_bytes: int) -> list[dict]:
    if not records:
        return []
    with tempfile.TemporaryDirectory(prefix="civweave-pack-") as temp_name:
        temp = Path(temp_name)
        db = temp / "knowledge.sqlite"
        create_database(records, db, layer, school)
        manifest = {
            "schema": "civweave.knowledge-layer-pack.v1",
            "layer": layer,
            "school_slug": school,
            "article_count": len(records),
            "source": "Wikimedia Structured Wikipedia",
            "license": "CC BY-SA 4.0",
            "articles": [{"article_title": row["title"], "canonical_url": row["url"], "source_id": row["identifier"]} for row in records],
        }
        (temp / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (temp / "RIGHTS.md").write_text("# Rights\n\nArticle text is derived from Wikimedia projects and remains subject to the source licenses recorded by Wikimedia. Civweave preserves canonical article URLs and source identifiers for attribution.\n", encoding="utf-8")
        out_dir.mkdir(parents=True, exist_ok=True)
        pack_name = f"{school}-{sequence:03d}.zip"
        target = out_dir / pack_name
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            archive.write(db, "knowledge.sqlite")
            archive.write(temp / "source-manifest.json", "source-manifest.json")
            archive.write(temp / "RIGHTS.md", "RIGHTS.md")
    size = target.stat().st_size
    if size > max_zip_bytes and len(records) > 1:
        target.unlink()
        midpoint = len(records) // 2
        left = write_pack(records[:midpoint], out_dir, layer, school, sequence, max_zip_bytes)
        next_sequence = sequence + len(left)
        right = write_pack(records[midpoint:], out_dir, layer, school, next_sequence, max_zip_bytes)
        return left + right
    if size > max_zip_bytes:
        target.unlink(missing_ok=True)
        raise RuntimeError(f"Single-article pack exceeds {max_zip_bytes} bytes: {layer}/{school}/{records[0]['title']}")
    return [{
        "pack_id": f"{layer}:{school}:{sequence:03d}",
        "zip_file": f"packs/{pack_name}",
        "zip_bytes": size,
        "zip_sha256": sha256_file(target),
        "article_count": len(records),
        "routing_terms": routing_terms(records),
    }]


def partition_records(rows: Iterable[dict], target_bytes: int) -> list[list[dict]]:
    chunks: list[list[dict]] = []
    current: list[dict] = []
    current_bytes = 0
    for record in rows:
        estimate = len(json.dumps(record, ensure_ascii=False).encode("utf-8"))
        if current and current_bytes + estimate > target_bytes:
            chunks.append(current)
            current, current_bytes = [], 0
        current.append(record)
        current_bytes += estimate
    if current:
        chunks.append(current)
    return chunks


def build_layer(layer: str, membership: dict[str, set[str]], spool_root: Path, output_root: Path, target_bytes: int, max_zip_bytes: int, source_revision: str) -> dict:
    layer_root = output_root / "tiers" / layer
    if layer_root.exists():
        shutil.rmtree(layer_root)
    schools = []
    sums: list[str] = []
    total_articles = 0
    total_bytes = 0
    for school in SCHOOL_ORDER:
        records = list(load_spool(spool_root / layer / f"{school}.jsonl"))
        packs: list[dict] = []
        sequence = 1
        for chunk in partition_records(records, target_bytes):
            made = write_pack(chunk, layer_root / "packs", layer, school, sequence, max_zip_bytes)
            packs.extend(made)
            sequence += len(made)
        article_count = sum(int(pack["article_count"]) for pack in packs)
        zip_bytes = sum(int(pack["zip_bytes"]) for pack in packs)
        total_articles += article_count
        total_bytes += zip_bytes
        for pack in packs:
            sums.append(f"{pack['zip_sha256']}  {pack['zip_file']}")
        schools.append({
            "school_slug": school,
            "school_name": SCHOOL_NAMES[school],
            "target_article_count": len(membership[school]),
            "article_count": article_count,
            "missing_article_count": max(0, len(membership[school]) - article_count),
            "pack_count": len(packs),
            "zip_bytes": zip_bytes,
            "packs": packs,
        })
    catalog = {
        "schema": SCHEMA,
        "layer": layer,
        "built_at": now_iso(),
        "source_dataset": "wikimedia/structured-wikipedia",
        "source_revision": source_revision,
        "base_url": f"/downloads/knowledge-schools/tiers/{layer}/",
        "vital_level": 4 if layer == "expanded" else 5,
        "delta_from_level": 3 if layer == "expanded" else 4,
        "article_count": total_articles,
        "zip_bytes": total_bytes,
        "schools": schools,
    }
    layer_root.mkdir(parents=True, exist_ok=True)
    (layer_root / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (layer_root / "SHA256SUMS").write_text("\n".join(sums) + ("\n" if sums else ""), encoding="utf-8")
    return catalog


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--membership", type=Path, required=True)
    parser.add_argument("--source", type=Path, action="append", required=True, help="JSONL/NDJSON(.gz), Parquet file, or directory; repeatable")
    parser.add_argument("--output", type=Path, default=Path("build/knowledge-library/materialized"))
    parser.add_argument("--layers", default="expanded,deep")
    parser.add_argument("--source-revision", default="current")
    parser.add_argument("--target-uncompressed-mib", type=int, default=40)
    parser.add_argument("--max-pack-mib", type=float, default=23.0)
    parser.add_argument("--max-missing-ratio", type=float, default=0.02)
    args = parser.parse_args()
    layers, route = load_membership(args.membership)
    wanted_layers = [value.strip() for value in args.layers.split(",") if value.strip()]
    if any(value not in layers for value in wanted_layers):
        raise SystemExit("--layers may contain only expanded,deep")
    route = {key: value for key, value in route.items() if value.split("\t", 1)[0] in wanted_layers}
    paths = source_paths(args.source)
    if not paths:
        raise SystemExit("No source files found.")
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="civweave-tier-spool-") as spool_name:
        spool = Path(spool_name)
        counts, found = spool_selected(paths, route, spool)
        missing = len(route) - len(found)
        ratio = missing / max(1, len(route))
        if ratio > args.max_missing_ratio:
            raise RuntimeError(f"Source corpus missed {missing}/{len(route)} selected Vital titles ({ratio:.2%}); maximum is {args.max_missing_ratio:.2%}.")
        catalogs = {}
        for layer in wanted_layers:
            catalogs[layer] = build_layer(layer, layers[layer], spool, args.output, args.target_uncompressed_mib * 1024 * 1024, int(args.max_pack_mib * 1024 * 1024), args.source_revision)
    manifest = {
        "schema": TIER_SCHEMA,
        "revision": "knowledge-library-tiers-v1",
        "updated_at": now_iso(),
        "source": {"dataset": "wikimedia/structured-wikipedia", "membership": "English Wikipedia Vital articles", "license": "CC BY-SA 4.0", "strategy": "additive-deltas"},
        "layers": [
            {"slug": "foundation", "name": "Foundation Library", "vital_level": 3, "delta_from_level": None, "cumulative_target_articles": 1000, "materialized_articles": 1001, "availability": "ready", "storage": "legacy-school-catalog", "catalog_url": "/downloads/knowledge-schools/catalog.json", "dependencies": []},
            {"slug": "expanded", "name": "Expanded Local Library", "vital_level": 4, "delta_from_level": 3, "cumulative_target_articles": 10000, "materialized_articles": int(catalogs.get("expanded", {}).get("article_count", 0)), "availability": "ready" if "expanded" in catalogs else "build-required", "storage": "chunked-school-delta", "catalog_url": "/downloads/knowledge-schools/tiers/expanded/catalog.json", "dependencies": ["foundation"]},
            {"slug": "deep", "name": "Deep Local Library", "vital_level": 5, "delta_from_level": 4, "cumulative_target_articles": 50000, "materialized_articles": int(catalogs.get("deep", {}).get("article_count", 0)), "availability": "ready" if "deep" in catalogs else "build-required", "storage": "chunked-school-delta", "catalog_url": "/downloads/knowledge-schools/tiers/deep/catalog.json", "dependencies": ["foundation", "expanded"]},
        ],
    }
    (args.output / "tiers.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build = {"schema": "civweave.knowledge-library-build.v1", "built_at": now_iso(), "source_files": [str(path) for path in paths], "selected_titles": len(route), "matched_titles": len(found), "missing_titles": missing, "counts": {f"{layer}/{school}": count for (layer, school), count in sorted(counts.items())}}
    (args.output / "BUILD-MANIFEST.json").write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "selected": len(route), "matched": len(found), "missing": missing, "layers": {key: value["article_count"] for key, value in catalogs.items()}}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

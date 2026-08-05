#!/usr/bin/env python3
"""Split Commonweave Knowledge Seed 1 into independently installable category schools."""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import shutil
import sqlite3
import urllib.parse
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import requests
from bs4 import BeautifulSoup, Tag

CATEGORY_URL = "https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level_3"
HEADERS = {
    "User-Agent": "CommonweaveKnowledgeSeedSchools/1.0 (https://github.com/cerbanimo-dev/Commonweave)",
    "Accept-Language": "en-US,en;q=0.9",
}
SCHOOL_HEADINGS = [
    "People", "History", "Geography", "Arts", "Everyday life",
    "Philosophy and religion", "Society and social sciences",
    "Health, medicine and disease", "Science", "Technology", "Mathematics",
]
SCHOOL_NAMES = {
    "People": "School of People and Lives",
    "History": "School of History",
    "Geography": "School of Geography",
    "Arts": "School of Arts",
    "Everyday life": "School of Everyday Life",
    "Philosophy and religion": "School of Philosophy and Religion",
    "Society and social sciences": "School of Society and Social Sciences",
    "Health, medicine and disease": "School of Health, Medicine and Disease",
    "Science": "School of Science",
    "Technology": "School of Technology",
    "Mathematics": "School of Mathematics",
    "Crossroads": "Foundations Crossroads",
}
VIDEO_SCHOOL = {
    "communication": "society-and-social-sciences",
    "psychology": "society-and-social-sciences",
    "mathematics": "mathematics",
    "physical-sciences": "science",
    "earth-and-space": "science",
    "technology-and-engineering": "technology",
    "biology-and-health": "health-medicine-and-disease",
}
TABLES = ["articles", "sections", "internal_links", "external_links", "references_list", "metadata", "failures", "video_references"]
INDEXES = [
    "idx_articles_domain", "idx_external_links_source", "idx_internal_links_in_seed",
    "idx_internal_links_source", "idx_internal_links_target", "idx_references_article",
    "idx_sections_article",
]


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", urllib.parse.unquote(text or "").replace("_", " ")).strip()


def title_key(text: str) -> str:
    return normalize(text).casefold()


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.casefold().replace("&", " and ")).strip("-")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def human_bytes(value: int) -> str:
    amount = float(value)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if amount < 1024 or unit == "GiB":
            return f"{int(amount)} B" if unit == "B" else f"{amount:.2f} {unit}"
        amount /= 1024
    return str(value)


def source_articles(source_db: Path) -> list[dict[str, Any]]:
    with sqlite3.connect(source_db) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute(
            "SELECT id,selection_ordinal,selection_title,title,canonical_url,word_count "
            "FROM articles ORDER BY selection_ordinal,id"
        )]


def href_title(href: str) -> str | None:
    if not href or href.startswith("#"):
        return None
    parsed = urllib.parse.urlparse(urllib.parse.urljoin("https://en.wikipedia.org/wiki/", href))
    if parsed.netloc not in {"en.wikipedia.org", "www.en.wikipedia.org"} or not parsed.path.startswith("/wiki/"):
        return None
    title = normalize(parsed.path[len("/wiki/"):])
    return None if not title or ":" in title else title


def fetch_assignments(articles: list[dict[str, Any]], url: str) -> tuple[dict[int, dict[str, str]], dict[str, Any]]:
    aliases: dict[str, int] = {}
    for article in articles:
        aliases.setdefault(title_key(article["selection_title"]), article["id"])
        aliases.setdefault(title_key(article["title"]), article["id"])

    response = requests.get(url, headers=HEADERS, timeout=(15, 90))
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    root = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one(".mw-parser-output")
    if root is None:
        raise RuntimeError("Could not locate the Level 3 category page body")

    assignments: dict[int, dict[str, str]] = {}
    current = h3 = h4 = ""
    current_titles: set[str] = set()
    duplicates: list[dict[str, str]] = []
    for element in root.find_all(["h2", "h3", "h4", "li"]):
        if not isinstance(element, Tag):
            continue
        if element.name in {"h2", "h3", "h4"}:
            heading = normalize(re.sub(r"\[edit\]$", "", element.get_text(" ", strip=True), flags=re.I))
            if element.name == "h2":
                current = heading if heading in SCHOOL_HEADINGS else ""
                h3 = h4 = ""
            elif current and element.name == "h3":
                h3, h4 = heading, ""
            elif current and element.name == "h4":
                h4 = heading
            continue
        if not current:
            continue
        for link in element.find_all("a"):
            if link.find_parent("li") is not element:
                continue
            title = href_title(link.get("href", ""))
            if not title:
                continue
            current_titles.add(title_key(title))
            article_id = aliases.get(title_key(title))
            if article_id is None:
                continue
            proposed = {
                "heading": current,
                "school_name": SCHOOL_NAMES[current],
                "school_slug": slugify(current),
                "subdomain": " / ".join(part for part in (h3, h4) if part),
            }
            if article_id in assignments:
                if assignments[article_id]["school_slug"] != proposed["school_slug"]:
                    duplicates.append({
                        "article_id": article_id,
                        "kept_school": assignments[article_id]["school_slug"],
                        "ignored_school": proposed["school_slug"],
                    })
                continue
            assignments[article_id] = proposed

    unmatched = [article for article in articles if article["id"] not in assignments]
    for article in unmatched:
        assignments[article["id"]] = {
            "heading": "Crossroads",
            "school_name": SCHOOL_NAMES["Crossroads"],
            "school_slug": "crossroads",
            "subdomain": "Retired, renamed, or remapped Level 3 entries",
        }
    audit = {
        "category_url": url,
        "retrieved_at": now_iso(),
        "html_sha256": hashlib.sha256(response.content).hexdigest(),
        "source_articles": len(articles),
        "assigned_from_current_page": len(articles) - len(unmatched),
        "crossroads_articles": len(unmatched),
        "crossroads_titles": [article["title"] for article in unmatched],
        "current_page_titles_not_in_source": sorted(title for title in current_titles if title not in aliases),
        "duplicate_cross_school_matches": duplicates,
    }
    return assignments, audit


def schema_sql(connection: sqlite3.Connection, object_type: str, names: Iterable[str]) -> list[str]:
    placeholders = ",".join("?" for _ in names)
    return [row[0] for row in connection.execute(
        f"SELECT sql FROM source.sqlite_master WHERE type=? AND name IN ({placeholders}) AND sql IS NOT NULL ORDER BY name",
        (object_type, *names),
    )]


def build_school_db(source_db: Path, destination: Path, ids: list[int], school: dict[str, str], assignments: dict[int, dict[str, str]]) -> dict[str, int]:
    destination.unlink(missing_ok=True)
    connection = sqlite3.connect(destination)
    try:
        connection.execute("PRAGMA journal_mode=OFF")
        connection.execute("PRAGMA synchronous=OFF")
        connection.execute("PRAGMA temp_store=MEMORY")
        connection.execute("PRAGMA foreign_keys=OFF")
        connection.execute("ATTACH DATABASE ? AS source", (str(source_db),))
        for statement in schema_sql(connection, "table", TABLES):
            connection.execute(statement)
        connection.execute(
            "CREATE TABLE school_membership (article_id INTEGER PRIMARY KEY, school_slug TEXT NOT NULL, "
            "school_name TEXT NOT NULL, source_heading TEXT NOT NULL, subdomain TEXT NOT NULL)"
        )
        connection.execute("CREATE TEMP TABLE selected_ids (id INTEGER PRIMARY KEY)")
        connection.executemany("INSERT INTO selected_ids VALUES (?)", ((article_id,) for article_id in ids))
        connection.execute("INSERT INTO articles SELECT a.* FROM source.articles a JOIN selected_ids s ON s.id=a.id")
        connection.execute("INSERT INTO sections SELECT x.* FROM source.sections x JOIN selected_ids s ON s.id=x.article_id")
        connection.execute("INSERT INTO external_links SELECT x.* FROM source.external_links x JOIN selected_ids s ON s.id=x.article_id")
        connection.execute("INSERT INTO references_list SELECT x.* FROM source.references_list x JOIN selected_ids s ON s.id=x.article_id")
        connection.execute(
            "INSERT INTO internal_links "
            "SELECT x.id,x.article_id,x.target_title,x.target_url,x.anchor_text,x.section_heading,"
            "CASE WHEN EXISTS (SELECT 1 FROM source.articles t JOIN selected_ids p ON p.id=t.id "
            "WHERE t.title=x.target_title OR t.selection_title=x.target_title) THEN 1 ELSE 0 END "
            "FROM source.internal_links x JOIN selected_ids s ON s.id=x.article_id"
        )
        connection.execute("INSERT INTO metadata SELECT * FROM source.metadata")
        for key, value in {
            "seed_kind": "category-school",
            "school_slug": school["school_slug"],
            "school_name": school["school_name"],
            "source_heading": school["heading"],
            "split_at": now_iso(),
            "internal_link_scope": "current-school; use bundle catalog for cross-school targets",
        }.items():
            connection.execute(
                "INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )
        connection.executemany(
            "INSERT INTO school_membership VALUES (?,?,?,?,?)",
            [(article_id, school["school_slug"], school["school_name"], school["heading"], assignments[article_id]["subdomain"]) for article_id in ids],
        )
        video_domains = [domain for domain, slug in VIDEO_SCHOOL.items() if slug == school["school_slug"]]
        if video_domains:
            placeholders = ",".join("?" for _ in video_domains)
            connection.execute(
                f"INSERT INTO video_references SELECT * FROM source.video_references WHERE domain IN ({placeholders})",
                tuple(video_domains),
            )
        for statement in schema_sql(connection, "index", INDEXES):
            connection.execute(statement)
        connection.execute("CREATE INDEX idx_school_membership ON school_membership(school_slug,subdomain)")
        connection.execute(
            "CREATE VIRTUAL TABLE section_fts USING fts5(article_title,heading,text,content='sections',content_rowid='id',"
            "tokenize='unicode61 remove_diacritics 2')"
        )
        connection.execute(
            "INSERT INTO section_fts(rowid,article_title,heading,text) SELECT id,article_title,heading,text FROM sections"
        )
        connection.commit()
        connection.execute("PRAGMA optimize")
        connection.execute("VACUUM")
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError(f"Integrity check failed for {destination.name}")
        counts = {
            "articles": connection.execute("SELECT COUNT(*) FROM articles").fetchone()[0],
            "sections": connection.execute("SELECT COUNT(*) FROM sections").fetchone()[0],
            "internal_links": connection.execute("SELECT COUNT(*) FROM internal_links").fetchone()[0],
            "internal_links_in_school": connection.execute("SELECT COUNT(*) FROM internal_links WHERE in_seed=1").fetchone()[0],
            "external_links": connection.execute("SELECT COUNT(*) FROM external_links").fetchone()[0],
            "references": connection.execute("SELECT COUNT(*) FROM references_list").fetchone()[0],
            "video_references": connection.execute("SELECT COUNT(*) FROM video_references").fetchone()[0],
            "words": connection.execute("SELECT COALESCE(SUM(word_count),0) FROM articles").fetchone()[0],
        }
        fts_count = connection.execute("SELECT COUNT(*) FROM section_fts").fetchone()[0]
        if counts["articles"] != len(ids) or fts_count != counts["sections"]:
            raise RuntimeError(f"Count validation failed for {destination.name}")
        return counts
    finally:
        connection.close()


def write_manifest(source_db: Path, path: Path, ids: list[int], assignments: dict[int, dict[str, str]]) -> None:
    with sqlite3.connect(source_db) as connection, path.open("w", newline="", encoding="utf-8") as handle:
        connection.row_factory = sqlite3.Row
        writer = csv.writer(handle)
        writer.writerow(["article_id", "selection_ordinal", "selection_title", "title", "school_slug", "school_name", "subdomain", "revision_id", "revision_timestamp", "canonical_url", "word_count", "retrieved_at"])
        for article_id in ids:
            row = connection.execute(
                "SELECT id,selection_ordinal,selection_title,title,revision_id,revision_timestamp,canonical_url,word_count,retrieved_at FROM articles WHERE id=?",
                (article_id,),
            ).fetchone()
            assignment = assignments[article_id]
            writer.writerow([
                row["id"], row["selection_ordinal"], row["selection_title"], row["title"],
                assignment["school_slug"], assignment["school_name"], assignment["subdomain"],
                row["revision_id"], row["revision_timestamp"], row["canonical_url"], row["word_count"], row["retrieved_at"],
            ])


def zip_dir(source: Path, destination: Path) -> None:
    destination.unlink(missing_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source.parent))


def write_checksums(root: Path, paths: Iterable[Path]) -> None:
    (root / "SHA256SUMS").write_text(
        "\n".join(f"{sha256_file(path)}  {path.relative_to(root).as_posix()}" for path in sorted(paths)) + "\n",
        encoding="utf-8",
    )


def build_catalog(path: Path, source_db: Path, assignments: dict[int, dict[str, str]], records: list[dict[str, Any]]) -> None:
    path.unlink(missing_ok=True)
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            "CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);"
            "CREATE TABLE schools(school_slug TEXT PRIMARY KEY,school_name TEXT NOT NULL,source_heading TEXT NOT NULL,"
            "article_count INTEGER NOT NULL,section_count INTEGER NOT NULL,word_count INTEGER NOT NULL,zip_file TEXT NOT NULL,"
            "zip_bytes INTEGER NOT NULL,zip_sha256 TEXT NOT NULL,database_bytes INTEGER NOT NULL,database_sha256 TEXT NOT NULL);"
            "CREATE TABLE articles(article_id INTEGER PRIMARY KEY,selection_title TEXT NOT NULL,title TEXT NOT NULL,"
            "school_slug TEXT NOT NULL,subdomain TEXT NOT NULL,canonical_url TEXT NOT NULL,revision_id INTEGER,revision_timestamp TEXT);"
            "CREATE INDEX idx_catalog_title ON articles(title);"
            "CREATE INDEX idx_catalog_school ON articles(school_slug,subdomain);"
            "CREATE TABLE cross_school_links(source_school TEXT NOT NULL,target_school TEXT NOT NULL,link_count INTEGER NOT NULL,"
            "PRIMARY KEY(source_school,target_school));"
        )
        connection.executemany("INSERT INTO metadata VALUES (?,?)", [
            ("catalog_kind", "commonweave-category-school-catalog"),
            ("built_at", now_iso()),
            ("source_database_sha256", sha256_file(source_db)),
        ])
        connection.executemany("INSERT INTO schools VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
            (r["school_slug"], r["school_name"], r["source_heading"], r["counts"]["articles"], r["counts"]["sections"], r["counts"]["words"], r["zip_file"], r["zip_bytes"], r["zip_sha256"], r["database_bytes"], r["database_sha256"]) for r in records
        ])
        with sqlite3.connect(source_db) as source:
            source.row_factory = sqlite3.Row
            rows = list(source.execute("SELECT id,selection_title,title,canonical_url,revision_id,revision_timestamp FROM articles"))
            connection.executemany("INSERT INTO articles VALUES (?,?,?,?,?,?,?,?)", [
                (row["id"], row["selection_title"], row["title"], assignments[row["id"]]["school_slug"], assignments[row["id"]]["subdomain"], row["canonical_url"], row["revision_id"], row["revision_timestamp"]) for row in rows
            ])
            title_school: dict[str, str] = {}
            for row in rows:
                slug = assignments[row["id"]]["school_slug"]
                title_school[title_key(row["title"])] = slug
                title_school[title_key(row["selection_title"])] = slug
            links: Counter[tuple[str, str]] = Counter()
            for article_id, target_title in source.execute("SELECT article_id,target_title FROM internal_links"):
                source_slug = assignments[article_id]["school_slug"]
                target_slug = title_school.get(title_key(target_title))
                if target_slug and target_slug != source_slug:
                    links[(source_slug, target_slug)] += 1
            connection.executemany("INSERT INTO cross_school_links VALUES (?,?,?)", [(a, b, count) for (a, b), count in sorted(links.items())])
        connection.commit()
        connection.execute("VACUUM")
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Catalog integrity check failed")
    finally:
        connection.close()


def split(source_db: Path, output: Path, category_url: str, unpack_script: Path | None) -> Path:
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    schools_dir = output / "schools"
    work_dir = output / ".work"
    schools_dir.mkdir()
    work_dir.mkdir()

    articles = source_articles(source_db)
    assignments, reconciliation = fetch_assignments(articles, category_url)
    grouped: dict[str, list[int]] = defaultdict(list)
    meta: dict[str, dict[str, str]] = {}
    for article in articles:
        assignment = assignments[article["id"]]
        grouped[assignment["school_slug"]].append(article["id"])
        meta[assignment["school_slug"]] = assignment

    ordered = [slugify(heading) for heading in SCHOOL_HEADINGS]
    if "crossroads" in grouped:
        ordered.append("crossroads")
    records: list[dict[str, Any]] = []
    for order, slug in enumerate(ordered, start=1):
        ids = grouped.get(slug, [])
        if not ids:
            continue
        school = meta[slug]
        package_name = f"commonweave-school-{slug}"
        package_dir = work_dir / package_name
        package_dir.mkdir()
        db_path = package_dir / f"{package_name}.sqlite"
        counts = build_school_db(source_db, db_path, ids, school, assignments)
        write_manifest(source_db, package_dir / "article-manifest.csv", ids, assignments)
        school_json = {
            "schema": "commonweave.knowledge-school.v1",
            "order": order,
            "school_slug": slug,
            "school_name": school["school_name"],
            "source_heading": school["heading"],
            "source_category_url": category_url,
            "built_at": now_iso(),
            "counts": counts,
            "database_file": db_path.name,
            "database_sha256": sha256_file(db_path),
            "database_bytes": db_path.stat().st_size,
        }
        (package_dir / "school.json").write_text(json.dumps(school_json, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (package_dir / "README.md").write_text(
            f"# {school['school_name']}\n\nContains {counts['articles']} foundational articles and {counts['sections']} searchable sections. "
            "Use the bundle catalog for cross-school routing.\n",
            encoding="utf-8",
        )
        (package_dir / "RIGHTS.md").write_text(
            "Wikipedia article text is CC BY-SA 4.0. Canonical URLs, revision IDs, timestamps, retrieval times, and attribution are retained. External resources are references unless separately reviewed.\n",
            encoding="utf-8",
        )
        write_checksums(package_dir, [path for path in package_dir.iterdir() if path.is_file()])
        zip_path = schools_dir / f"{package_name}.zip"
        zip_dir(package_dir, zip_path)
        record = {
            "order": order,
            "school_slug": slug,
            "school_name": school["school_name"],
            "source_heading": school["heading"],
            "zip_file": zip_path.relative_to(output).as_posix(),
            "zip_bytes": zip_path.stat().st_size,
            "zip_human": human_bytes(zip_path.stat().st_size),
            "zip_sha256": sha256_file(zip_path),
            "database_bytes": db_path.stat().st_size,
            "database_human": human_bytes(db_path.stat().st_size),
            "database_sha256": sha256_file(db_path),
            "counts": counts,
        }
        records.append(record)
        print(f"built {slug}: {counts['articles']} articles, {record['zip_human']}", flush=True)

    catalog_db = output / "commonweave-school-catalog.sqlite"
    build_catalog(catalog_db, source_db, assignments, records)
    catalog = {
        "schema": "commonweave.knowledge-school-catalog.v1",
        "built_at": now_iso(),
        "source_database": source_db.name,
        "source_database_sha256": sha256_file(source_db),
        "source_category_url": category_url,
        "catalog_database": catalog_db.name,
        "catalog_database_sha256": sha256_file(catalog_db),
        "schools": records,
        "recommended_batches": {
            "human-worlds": ["people", "history", "geography", "everyday-life", "philosophy-and-religion", "society-and-social-sciences", "arts"],
            "making-and-measuring": ["health-medicine-and-disease", "science", "technology", "mathematics"],
            "complete-foundations": [record["school_slug"] for record in records],
        },
        "reconciliation": reconciliation,
    }
    (output / "catalog.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (output / "RECONCILIATION.json").write_text(json.dumps(reconciliation, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if unpack_script and unpack_script.is_file():
        shutil.copy2(unpack_script, output / "batch_unpack_schools.py")
    (output / "README.md").write_text(
        "# Commonweave category-school seeds\n\nEach ZIP in `schools/` is independently installable. The catalog maps every article and cross-school route.\n\n"
        "Example: `python batch_unpack_schools.py --schools all --destination ./installed`\n",
        encoding="utf-8",
    )
    write_checksums(output, [path for path in output.rglob("*") if path.is_file() and ".work" not in path.parts and path.name != "SHA256SUMS"])
    shutil.rmtree(work_dir)
    bundle = output.with_suffix(".zip")
    zip_dir(output, bundle)
    (output.parent / f"{bundle.name}.sha256").write_text(f"{sha256_file(bundle)}  {bundle.name}\n", encoding="utf-8")
    print(json.dumps({
        "schools": len(records),
        "articles": sum(record["counts"]["articles"] for record in records),
        "individual_seed_bytes": sum(record["zip_bytes"] for record in records),
        "bundle_zip": str(bundle),
        "bundle_bytes": bundle.stat().st_size,
        "bundle_human": human_bytes(bundle.stat().st_size),
        "reconciliation": reconciliation,
    }, indent=2, ensure_ascii=False))
    return bundle


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-db", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--category-url", default=CATEGORY_URL)
    parser.add_argument("--unpack-script", type=Path)
    args = parser.parse_args()
    if not args.source_db.is_file():
        raise SystemExit(f"Source database not found: {args.source_db}")
    split(args.source_db.resolve(), args.output.resolve(), args.category_url, args.unpack_script)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

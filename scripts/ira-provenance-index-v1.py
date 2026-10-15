#!/usr/bin/env python3
"""Historical IRA tweet provenance, not a live-account blacklist.

Index official FiveThirtyEight/Clemson archive CSVs (downloaded separately) and
compare new training documents against exact historical tweet IDs or text hashes.
No network use, no training-data deletion, no inference about current owners.
"""
import argparse
import csv
import hashlib
import json
import re
import sqlite3
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

EVIDENCE = "https://github.com/fivethirtyeight/russian-troll-tweets"
SCHEMA = "civweave.ira-historical-post-provenance.v1"
FIELDS = ("url", "canonicalUrl", "source_url", "sourceUrl", "article_url", "permalink")

def normalize_body(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text or "")).strip()

def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def tweet_id_from_url(text):
    try:
        parsed = urlsplit(str(text).strip())
        host = (parsed.hostname or "").lower()
        if host not in {"x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "www.x.com"}:
            return None
        found = re.search(r"/status/(\d+)(?:/|$)", parsed.path, flags=re.I)
        return found.group(1) if found else None
    except (ValueError, TypeError):
        return None

def index_csvs(directory, db_path):
    paths = sorted(Path(directory).glob("IRAhandle_tweets_*.csv"))
    if not paths:
        raise ValueError("No IRAhandle_tweets_*.csv files found in directory")
    db = sqlite3.connect(db_path)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS historical_posts (
            tweet_id TEXT PRIMARY KEY, author_at_publication TEXT,
            published_at TEXT, body_sha256 TEXT, body_length INTEGER,
            evidence TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS historical_body_idx ON historical_posts(body_sha256);
    """)
    total, valid = 0, 0
    for path in paths:
        with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as stream:
            reader = csv.DictReader(stream)
            if not {"author", "content", "article_url"}.issubset(reader.fieldnames or []):
                raise ValueError(f"{path}: missing expected FiveThirtyEight columns")
            rows = []
            for item in reader:
                total += 1
                tweet_id = str(item.get("tweet_id") or "").strip()
                if not tweet_id.isdigit():
                    tweet_id = tweet_id_from_url(item.get("article_url", ""))
                if not tweet_id:
                    continue
                body = normalize_body(item.get("content", ""))
                valid += 1
                rows.append((tweet_id, (item.get("author") or "")[:120], item.get("publish_date") or None,
                             digest(body) if body else None, len(body), EVIDENCE))
                if len(rows) >= 5000:
                    db.executemany("INSERT OR IGNORE INTO historical_posts VALUES (?,?,?,?,?,?)", rows)
                    db.commit()
                    rows.clear()
            if rows:
                db.executemany("INSERT OR IGNORE INTO historical_posts VALUES (?,?,?,?,?,?)", rows)
                db.commit()
    count = db.execute("SELECT COUNT(*) FROM historical_posts").fetchone()[0]
    db.close()
    return {"fileCount": len(paths), "rowsRead": total, "rowsWithTweetId": valid, "indexedTweets": count,
            "evidence": EVIDENCE, "classification": "historical IRA-associated posts (2012-2018), not current account ownership"}

def first_column(record, columns):
    return next((record[name] for name in columns if isinstance(record.get(name), str) and record[name]), "")

def scan_corpus(db_path, corpus_path, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(f"file:{Path(db_path).resolve()}?mode=ro", uri=True)
    counts = {"records": 0, "quarantine": 0, "review": 0, "retained": 0, "invalid": 0}
    with Path(corpus_path).open("r", encoding="utf-8") as source, \
         (output_dir / "quarantine.jsonl").open("w", encoding="utf-8") as quarantined, \
         (output_dir / "review.jsonl").open("w", encoding="utf-8") as needs_review, \
         (output_dir / "retained.jsonl").open("w", encoding="utf-8") as retained:
        for line_number, line in enumerate(source, 1):
            if not line.strip():
                continue
            counts["records"] += 1
            try:
                record = json.loads(line)
                if not isinstance(record, dict):
                    raise ValueError("not a JSON object")
            except (json.JSONDecodeError, ValueError):
                counts["invalid"] += 1
                continue
            url = first_column(record, FIELDS)
            tweet_id = tweet_id_from_url(url)
            body = normalize_body(record.get("text") or record.get("content") or "")
            matched = None
            matched_by = None
            decision = "retained"
            if tweet_id:
                matched = db.execute("SELECT tweet_id,author_at_publication,published_at,body_sha256 FROM historical_posts WHERE tweet_id=?", (tweet_id,)).fetchone()
                if matched:
                    matched_by, decision = "exact-tweet-id", "quarantine"
            # Identical text is ONLY a candidate. Quotes, retweets, and syndication may be benign.
            if not matched and len(body) >= 160:
                matched = db.execute("SELECT tweet_id,author_at_publication,published_at,body_sha256 FROM historical_posts WHERE body_sha256=? LIMIT 1", (digest(body),)).fetchone()
                if matched:
                    matched_by, decision = "exact-text-duplicate", "review"
            audit = {"schema": SCHEMA, "decision": decision, "matchedBy": matched_by,
                     "sourceUrl": url, "sourceLineNumber": line_number, "evidence": EVIDENCE}
            if matched:
                audit["historicalTweetId"], audit["historicalAuthor"], audit["historicalPublishedAt"], audit["historicalTextHash"] = matched
            payload = json.dumps({"record": record, "audit": audit}, ensure_ascii=False) + "\n"
            if decision == "quarantine":
                counts["quarantine"] += 1
                quarantined.write(payload)
            elif decision == "review":
                counts["review"] += 1
                needs_review.write(payload)
            else:
                counts["retained"] += 1
                retained.write(payload)
    db.close()
    manifest = {"schema": SCHEMA, "counts": counts, "historicalEvidence": EVIDENCE,
                "important": "Exact tweet ID is historically attributed. A text-only match needs review. Do not infer current handle ownership."}
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    pindex = subs.add_parser("index")
    pindex.add_argument("--csv-dir", required=True)
    pindex.add_argument("--db", required=True)
    pscan = subs.add_parser("scan")
    pscan.add_argument("--db", required=True)
    pscan.add_argument("--jsonl", required=True)
    pscan.add_argument("--out", required=True)
    args = parser.parse_args()
    result = index_csvs(args.csv_dir, args.db) if args.command == "index" else scan_corpus(args.db, args.jsonl, args.out)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()

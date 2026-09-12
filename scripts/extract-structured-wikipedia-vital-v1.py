#!/usr/bin/env python3
"""Extract only Civweave's Vital-article deltas from Wikimedia Structured Wikipedia.

This uses DuckDB's native Hugging Face/httpfs support to query the public Parquet
corpus in place. It materializes only the titles needed by Expanded and Deep into a
small local Parquet file for build-knowledge-library-tiers-v1.py.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import duckdb

DEFAULT_DATASET = "hf://datasets/wikimedia/structured-wikipedia/enwiki/data/*.parquet"


def title_key(value: object) -> str:
    return " ".join(str(value or "").replace("_", " ").split()).casefold()


def selected_titles(membership_path: Path) -> tuple[list[str], dict[str, int]]:
    data = json.loads(membership_path.read_text(encoding="utf-8"))
    if data.get("schema") != "civweave.vital-membership.v1":
        raise RuntimeError("Unexpected Vital membership schema.")

    level3 = list(data["levels"]["3"]["articles"])
    level4_rows = data["levels"]["4"]["schools"]
    level5_rows = data["levels"]["5"]["schools"]

    level3_keys = {title_key(value) for value in level3}
    level4_titles = [value for rows in level4_rows.values() for value in rows]
    level5_titles = [value for rows in level5_rows.values() for value in rows]
    level4_keys = {title_key(value) for value in level4_titles}

    canonical: dict[str, str] = {}
    for value in level4_titles:
        key = title_key(value)
        if key not in level3_keys:
            canonical.setdefault(key, str(value).strip())
    for value in level5_titles:
        key = title_key(value)
        if key not in level4_keys:
            canonical.setdefault(key, str(value).strip())

    expanded_count = sum(1 for value in level4_titles if title_key(value) not in level3_keys)
    deep_count = sum(1 for value in level5_titles if title_key(value) not in level4_keys)
    return sorted(canonical.values(), key=str.casefold), {
        "foundation": len(level3_keys),
        "expanded_selected": expanded_count,
        "deep_selected": deep_count,
        "total_selected": len(canonical),
    }


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--membership", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--memory-limit", default="6GB")
    parser.add_argument("--temp-directory", type=Path)
    parser.add_argument("--max-missing-ratio", type=float, default=0.02)
    args = parser.parse_args()

    titles, counts = selected_titles(args.membership)
    if not titles:
        raise RuntimeError("Vital membership produced no Expanded/Deep titles.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        args.output.unlink()

    connection = duckdb.connect()
    connection.execute(f"SET threads={max(1, args.threads)}")
    connection.execute(f"SET memory_limit={sql_string(args.memory_limit)}")
    if args.temp_directory:
        args.temp_directory.mkdir(parents=True, exist_ok=True)
        connection.execute(f"SET temp_directory={sql_string(str(args.temp_directory))}")

    # httpfs provides hf:// dataset access. DuckDB may autoload it, but explicit
    # install/load keeps the workflow deterministic across runner images.
    connection.execute("INSTALL httpfs")
    connection.execute("LOAD httpfs")
    connection.execute("CREATE TEMP TABLE wanted(title VARCHAR PRIMARY KEY)")
    connection.executemany("INSERT INTO wanted VALUES (?)", [(title,) for title in titles])

    dataset = sql_string(args.dataset)
    output = sql_string(str(args.output))
    query = f"""
        SELECT
            src.name,
            src.identifier,
            src.url,
            src.abstract,
            src.description,
            src.license,
            src.version,
            src.sections
        FROM read_parquet({dataset}, union_by_name=true) AS src
        INNER JOIN wanted ON src.name = wanted.title
        QUALIFY row_number() OVER (PARTITION BY src.name ORDER BY src.identifier DESC NULLS LAST) = 1
    """
    connection.execute(f"COPY ({query}) TO {output} (FORMAT PARQUET, COMPRESSION ZSTD)")

    matched = int(connection.execute(f"SELECT count(*) FROM read_parquet({output})").fetchone()[0])
    missing = len(titles) - matched
    ratio = missing / max(1, len(titles))
    if ratio > args.max_missing_ratio:
        raise RuntimeError(
            f"Structured Wikipedia matched {matched}/{len(titles)} selected Vital titles; "
            f"missing ratio {ratio:.2%} exceeds {args.max_missing_ratio:.2%}."
        )

    stats = {
        "schema": "civweave.structured-wikipedia-extract.v1",
        "dataset": args.dataset,
        **counts,
        "matched": matched,
        "missing": missing,
        "missing_ratio": ratio,
        "output": str(args.output),
        "output_bytes": args.output.stat().st_size,
    }
    stats_path = args.output.with_suffix(args.output.suffix + ".manifest.json")
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

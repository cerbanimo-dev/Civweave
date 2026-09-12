#!/usr/bin/env python3
"""Fetch current English Wikipedia Vital-article membership without scraping article bodies.

The script walks only the Vital Articles list pages through the MediaWiki API and emits
article-title membership for Civweave's additive Foundation/Expanded/Deep compiler.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "CivweaveKnowledgeLibrary/1.0 (offline library membership builder)"

ROOTS = {
    4: {
        "people": "Wikipedia:Vital articles/Level/4/People",
        "history": "Wikipedia:Vital articles/Level/4/History",
        "geography": "Wikipedia:Vital articles/Level/4/Geography",
        "arts": "Wikipedia:Vital articles/Level/4/Arts",
        "everyday-life": "Wikipedia:Vital articles/Level/4/Everyday life",
        "philosophy-and-religion": "Wikipedia:Vital articles/Level/4/Philosophy and religion",
        "society-and-social-sciences": "Wikipedia:Vital articles/Level/4/Society and social sciences",
        "science": "Wikipedia:Vital articles/Level/4/Physical sciences",
        "biology-health": "Wikipedia:Vital articles/Level/4/Biology and health sciences",
        "technology": "Wikipedia:Vital articles/Level/4/Technology",
        "mathematics": "Wikipedia:Vital articles/Level/4/Mathematics",
    },
    5: {
        "people": "Wikipedia:Vital articles/Level/5/People",
        "history": "Wikipedia:Vital articles/Level/5/History",
        "geography": "Wikipedia:Vital articles/Level/5/Geography",
        "arts": "Wikipedia:Vital articles/Level/5/Arts",
        "everyday-life": "Wikipedia:Vital articles/Level/5/Everyday life",
        "philosophy-and-religion": "Wikipedia:Vital articles/Level/5/Philosophy and religion",
        "society-and-social-sciences": "Wikipedia:Vital articles/Level/5/Society and social sciences",
        "science": "Wikipedia:Vital articles/Level/5/Physical sciences",
        "biology-health": "Wikipedia:Vital articles/Level/5/Biology and health sciences",
        "technology": "Wikipedia:Vital articles/Level/5/Technology",
        "mathematics": "Wikipedia:Vital articles/Level/5/Mathematics",
    },
}

HEALTH_HINTS = ("health", "medicine", "medical", "disease", "clinical", "pathology", "pharmac", "nutrition")


def request_json(params: dict[str, str], retries: int = 4) -> dict:
    query = urllib.parse.urlencode({"format": "json", "formatversion": "2", **params})
    url = f"{API}?{query}"
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.load(response)
        except Exception as exc:
            last = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"MediaWiki request failed: {last}")


def links_for_page(title: str) -> list[dict]:
    rows: list[dict] = []
    continuation: dict[str, str] = {}
    while True:
        params = {
            "action": "query",
            "prop": "links",
            "titles": title,
            "pllimit": "max",
            "plnamespace": "0|4",
            **continuation,
        }
        data = request_json(params)
        pages = data.get("query", {}).get("pages", [])
        if not pages or pages[0].get("missing"):
            raise RuntimeError(f"Vital list page is missing: {title}")
        rows.extend(pages[0].get("links", []))
        cont = data.get("continue")
        if not cont:
            break
        continuation = {key: str(value) for key, value in cont.items() if key != "continue"}
    return rows


def crawl_root(root: str) -> tuple[set[str], dict[str, str]]:
    articles: set[str] = set()
    origin: dict[str, str] = {}
    queue = deque([root])
    visited: set[str] = set()
    prefix = root + "/"
    while queue:
        page = queue.popleft()
        if page in visited:
            continue
        visited.add(page)
        for link in links_for_page(page):
            namespace = int(link.get("ns", -1))
            title = str(link.get("title", "")).strip()
            if not title:
                continue
            if namespace == 0:
                articles.add(title)
                origin.setdefault(title, page)
            elif namespace == 4 and title.startswith(prefix) and title not in visited:
                queue.append(title)
        time.sleep(0.04)
    return articles, origin


def biology_school(origin_page: str) -> str:
    tail = origin_page.casefold().split("biology and health sciences", 1)[-1]
    return "health-medicine-and-disease" if any(hint in tail for hint in HEALTH_HINTS) else "science"


def fetch_level_three() -> list[str]:
    articles, _ = crawl_root("Wikipedia:Vital articles/Level/3")
    return sorted(articles, key=str.casefold)


def fetch_classified_level(level: int) -> dict[str, list[str]]:
    schools: dict[str, set[str]] = defaultdict(set)
    for route, root in ROOTS[level].items():
        articles, origins = crawl_root(root)
        if route != "biology-health":
            schools[route].update(articles)
            continue
        for title in articles:
            schools[biology_school(origins.get(title, root))].add(title)
    order = [
        "people", "history", "geography", "arts", "everyday-life",
        "philosophy-and-religion", "society-and-social-sciences",
        "health-medicine-and-disease", "science", "technology", "mathematics",
    ]
    claimed: set[str] = set()
    result: dict[str, list[str]] = {}
    for school in order:
        values = sorted((title for title in schools.get(school, set()) if title not in claimed), key=str.casefold)
        claimed.update(values)
        result[school] = values
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("build/knowledge-library/vital-membership.json"))
    args = parser.parse_args()
    level3 = fetch_level_three()
    level4 = fetch_classified_level(4)
    level5 = fetch_classified_level(5)
    all4 = sorted({title for rows in level4.values() for title in rows}, key=str.casefold)
    all5 = sorted({title for rows in level5.values() for title in rows}, key=str.casefold)
    payload = {
        "schema": "civweave.vital-membership.v1",
        "retrieved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": API,
        "levels": {
            "3": {"articles": level3, "count": len(level3)},
            "4": {"schools": level4, "count": len(all4)},
            "5": {"schools": level5, "count": len(all5)},
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"level3": len(level3), "level4": len(all4), "level5": len(all5), "output": str(args.output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

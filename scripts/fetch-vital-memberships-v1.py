#!/usr/bin/env python3
"""Fetch current English Wikipedia Vital-article membership without scraping article bodies.

The script walks only the Vital Articles list pages through the MediaWiki API and emits
article-title membership for Civweave's additive Foundation/Expanded/Deep compiler.
Requests are deliberately serialized and rate-limited because this is a catalog build,
not an interactive workload.
"""
from __future__ import annotations

import argparse
import email.utils
import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "CivweaveKnowledgeLibrary/1.1 (https://civweave.cc; offline-library membership builder)"
MIN_REQUEST_GAP_SECONDS = 0.8
MAX_RETRIES = 8
_last_request_at = 0.0

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


def _wait_for_request_slot() -> None:
    global _last_request_at
    elapsed = time.monotonic() - _last_request_at
    if elapsed < MIN_REQUEST_GAP_SECONDS:
        time.sleep(MIN_REQUEST_GAP_SECONDS - elapsed)
    _last_request_at = time.monotonic()


def _retry_after_seconds(error: urllib.error.HTTPError) -> float | None:
    raw = error.headers.get("Retry-After") if error.headers else None
    if not raw:
        return None
    try:
        return max(0.0, float(raw))
    except ValueError:
        try:
            when = email.utils.parsedate_to_datetime(raw)
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            return max(0.0, (when - datetime.now(timezone.utc)).total_seconds())
        except Exception:
            return None


def request_json(params: dict[str, str], retries: int = MAX_RETRIES) -> dict:
    query = urllib.parse.urlencode({
        "format": "json",
        "formatversion": "2",
        "maxlag": "5",
        **params,
    })
    url = f"{API}?{query}"
    last = None
    for attempt in range(retries):
        _wait_for_request_slot()
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                    "Accept-Encoding": "identity",
                },
            )
            with urllib.request.urlopen(req, timeout=60) as response:
                data = json.load(response)
            if data.get("error", {}).get("code") == "maxlag":
                raise RuntimeError(f"MediaWiki maxlag: {data['error'].get('info', 'server busy')}")
            return data
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 500, 502, 503, 504) or attempt + 1 >= retries:
                break
            retry_after = _retry_after_seconds(exc)
            delay = retry_after if retry_after is not None else min(60.0, 2.0 ** (attempt + 1))
            time.sleep(delay + random.uniform(0.2, 0.8))
        except Exception as exc:
            last = exc
            if attempt + 1 >= retries:
                break
            time.sleep(min(30.0, 1.5 * (attempt + 1)) + random.uniform(0.1, 0.5))
    raise RuntimeError(f"MediaWiki request failed after {retries} attempts: {last}")


def links_for_page(title: str) -> list[dict]:
    rows: list[dict] = []
    continuation: dict[str, str] = {}
    while True:
        params = {
            "action": "query",
            "prop": "links",
            "titles": title,
            "pllimit": "500",
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
        "request_policy": {
            "user_agent": USER_AGENT,
            "minimum_gap_seconds": MIN_REQUEST_GAP_SECONDS,
            "max_retries": MAX_RETRIES,
            "maxlag_seconds": 5,
        },
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

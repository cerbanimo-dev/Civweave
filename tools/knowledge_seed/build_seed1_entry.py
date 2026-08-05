#!/usr/bin/env python3
"""Run Seed 1 with MediaWiki-API discovery for the live Vital Articles list."""
from __future__ import annotations

import re
import urllib.parse

import build_seed1 as seed


def fetch_vital_list_api():
    response = seed.request(
        "GET",
        seed.API_URL,
        params={
            "action": "parse",
            "page": "Wikipedia:Vital articles/Level/3",
            "prop": "wikitext|links",
            "format": "json",
            "formatversion": "2",
            "disablelimitreport": "1",
            "disableeditsection": "1",
        },
    )
    payload = response.json()["parse"]
    wikitext = payload.get("wikitext", "")
    allowed = {
        item["title"]
        for item in payload.get("links", [])
        if item.get("ns") == 0 and item.get("exists", True)
    }
    first_heading = re.search(r"(?m)^==[^=].*?==\s*$", wikitext)
    body = wikitext[first_heading.start():] if first_heading else wikitext
    stop = re.search(r"(?mi)^==\s*(See also|References|External links|Notes|Further reading)\s*==\s*$", body)
    if stop:
        body = body[:stop.start()]

    h2 = h3 = h4 = ""
    seen = set()
    selections = []
    heading_pattern = re.compile(r"^(={2,4})\s*(.*?)\s*\1\s*$")
    link_pattern = re.compile(r"\[\[\s*([^\]|#]+)")

    for line in body.splitlines():
        heading_match = heading_pattern.match(line.strip())
        if heading_match:
            level = len(heading_match.group(1))
            heading = seed.normalize_ws(re.sub(r"<!--.*?-->", "", heading_match.group(2)))
            if level == 2:
                h2, h3, h4 = heading, "", ""
            elif level == 3:
                h3, h4 = heading, ""
            else:
                h4 = heading
            continue
        for match in link_pattern.finditer(line):
            title = seed.normalize_ws(match.group(1).replace("_", " "))
            if not title or title not in allowed or title in seen:
                continue
            prefix = title.split(":", 1)[0].lower() if ":" in title else ""
            if prefix in seed.EXCLUDED_NAMESPACES:
                continue
            seen.add(title)
            selections.append(
                seed.Selection(
                    ordinal=len(selections) + 1,
                    title=title,
                    domain=h2 or "Unclassified",
                    subdomain=" / ".join(part for part in (h3, h4) if part),
                    source_url="https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                )
            )

    audit = {
        "selection_url": seed.SELECTION_URL,
        "selection_api": seed.API_URL,
        "selection_method": "MediaWiki action=parse wikitext order intersected with parsed namespace-0 links",
        "retrieved_at": seed.now_iso(),
        "page_revision_id": payload.get("revid"),
        "wikitext_sha256": seed.sha256_bytes(wikitext.encode("utf-8")),
        "parsed_count": len(selections),
    }
    if not 950 <= len(selections) <= 1050:
        raise RuntimeError(
            f"MediaWiki list discovery returned {len(selections)} titles; expected approximately 1,000. "
            "Aborting rather than silently building the wrong corpus."
        )
    return selections, audit


seed.fetch_vital_list = fetch_vital_list_api
raise SystemExit(seed.main())

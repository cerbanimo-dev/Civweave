#!/usr/bin/env python3
"""Build compact additive Living Library manifests for direct Wikimedia downloads.

Civweave does not mirror Expanded/Deep article bodies.  This compiler publishes only
which canonical English Wikipedia titles belong to each Civweave Knowledge School.
The browser later fetches selected articles directly from Wikimedia and stores them on
the user's device.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

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


def clean_titles(values):
    return sorted({str(value).strip() for value in values or [] if str(value).strip()}, key=str.casefold)


def canonical_url(title: str) -> str:
    return "https://en.wikipedia.org/wiki/" + quote(title.replace(" ", "_"), safe="()!$&'*+,-.:;=@_~")


def article_rows(titles):
    return [{"title": title, "canonical_url": canonical_url(title)} for title in titles]


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--membership", type=Path, required=True)
    parser.add_argument("--foundation-catalog", type=Path, default=Path("public/downloads/knowledge-schools/catalog.json"))
    parser.add_argument("--output", type=Path, default=Path("public/downloads/knowledge-schools/upstream/v1"))
    parser.add_argument("--tiers", type=Path, default=Path("public/downloads/knowledge-schools/tiers.json"))
    args = parser.parse_args()

    membership = json.loads(args.membership.read_text(encoding="utf-8"))
    if membership.get("schema") != "civweave.vital-membership.v1":
        raise RuntimeError("Unexpected Vital membership schema.")
    catalog = json.loads(args.foundation_catalog.read_text(encoding="utf-8"))
    catalog_slugs = [row.get("school_slug") for row in catalog.get("schools", [])]
    if catalog_slugs != SCHOOL_ORDER:
        raise RuntimeError(f"Knowledge School order changed unexpectedly: {catalog_slugs}")

    foundation = set(clean_titles(membership.get("levels", {}).get("3", {}).get("articles", [])))
    if len(foundation) != 1001:
        raise RuntimeError(f"Expected exact shipped Foundation membership of 1001 titles, found {len(foundation)}.")
    level4_schools = membership.get("levels", {}).get("4", {}).get("schools", {})
    level5_schools = membership.get("levels", {}).get("5", {}).get("schools", {})
    all4 = {title for slug in SCHOOL_ORDER for title in clean_titles(level4_schools.get(slug, []))}

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    layer_specs = {
        "expanded": {
            "vital_level": 4,
            "delta_from_level": 3,
            "source": level4_schools,
            "subtract": foundation,
            "cumulative_target_articles": 10000,
        },
        "deep": {
            "vital_level": 5,
            "delta_from_level": 4,
            "source": level5_schools,
            "subtract": all4,
            "cumulative_target_articles": 50000,
        },
    }

    index_layers = []
    layer_counts = {}
    seen_by_layer = {}
    for layer, spec in layer_specs.items():
        seen = set()
        schools = []
        total = 0
        for order, slug in enumerate(SCHOOL_ORDER, start=1):
            titles = [
                title for title in clean_titles(spec["source"].get(slug, []))
                if title not in spec["subtract"] and title not in seen
            ]
            seen.update(titles)
            total += len(titles)
            rel = f"{layer}/{slug}.json"
            payload = {
                "schema": "civweave.knowledge-upstream-school.v1",
                "revision": "living-library-upstream-v1",
                "generated_at": generated_at,
                "layer": layer,
                "vital_level": spec["vital_level"],
                "delta_from_level": spec["delta_from_level"],
                "school_slug": slug,
                "school_name": SCHOOL_NAMES[slug],
                "article_count": len(titles),
                "delivery": {
                    "mode": "direct-upstream-cache",
                    "provider": "Wikimedia",
                    "project": "English Wikipedia",
                    "api": "https://en.wikipedia.org/w/rest.php/v1",
                    "page_route": "/page/{title}/with_html",
                    "canonical_base": "https://en.wikipedia.org/wiki/",
                    "license": "Wikipedia page content is reused under the license reported by the Wikimedia API; attribution remains attached per article.",
                },
                "articles": article_rows(titles),
            }
            write_json(args.output / rel, payload)
            schools.append({
                "order": order,
                "school_slug": slug,
                "school_name": SCHOOL_NAMES[slug],
                "article_count": len(titles),
                "manifest_url": f"/downloads/knowledge-schools/upstream/v1/{rel}",
            })
        if len(seen) != total:
            raise RuntimeError(f"Duplicate {layer} titles survived school assignment.")
        layer_counts[layer] = total
        seen_by_layer[layer] = seen
        index_layers.append({
            "slug": layer,
            "vital_level": spec["vital_level"],
            "delta_from_level": spec["delta_from_level"],
            "cumulative_target_articles": spec["cumulative_target_articles"],
            "article_count": total,
            "delivery": "direct-upstream-cache",
            "schools": schools,
        })

    if seen_by_layer["expanded"] & foundation:
        raise RuntimeError("Expanded manifest overlaps shipped Foundation titles.")
    if seen_by_layer["deep"] & all4:
        raise RuntimeError("Deep manifest overlaps Level 4 titles.")
    if layer_counts["expanded"] <= 0 or layer_counts["deep"] <= 0:
        raise RuntimeError(f"Upstream deltas are unexpectedly empty: {layer_counts}")

    index = {
        "schema": "civweave.knowledge-upstream-index.v1",
        "revision": "living-library-upstream-v1",
        "generated_at": generated_at,
        "source": {
            "membership": "English Wikipedia Vital articles",
            "membership_api": membership.get("source", "https://en.wikipedia.org/w/api.php"),
            "content_api": "https://en.wikipedia.org/w/rest.php/v1",
            "project": "English Wikipedia",
            "provider": "Wikimedia",
            "client_policy": "serial direct fetch; locally cached; no Civweave body mirror",
        },
        "foundation_articles": len(foundation),
        "layers": index_layers,
    }
    write_json(args.output / "index.json", index)

    tiers = json.loads(args.tiers.read_text(encoding="utf-8"))
    tiers["updated_at"] = generated_at
    tiers["source"] = {
        "membership": "English Wikipedia Vital articles",
        "homepage": "https://en.wikipedia.org/wiki/Wikipedia:Vital_articles",
        "content_api": "https://en.wikipedia.org/w/rest.php/v1",
        "license": "per-article Wikimedia license metadata",
        "strategy": "additive-direct-upstream-cache",
    }
    for record in tiers.get("layers", []):
        if record.get("slug") not in layer_specs:
            continue
        slug = record["slug"]
        record["availability"] = "source-ready"
        record["storage"] = "wikimedia-direct-cache"
        record["materialized_articles"] = 0
        record["indexed_articles"] = layer_counts[slug]
        record["manifest_url"] = "/downloads/knowledge-schools/upstream/v1/index.json"
        record.pop("catalog_url", None)
        record["description"] = (
            f"Adds the Vital Level {layer_specs[slug]['vital_level']} delta. Article bodies are fetched "
            "directly from English Wikipedia when the user downloads this tier and are cached only on that device."
        )
    write_json(args.tiers, tiers)

    print(json.dumps({
        "foundation": len(foundation),
        "expanded_delta": layer_counts["expanded"],
        "deep_delta": layer_counts["deep"],
        "index": str(args.output / "index.json"),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

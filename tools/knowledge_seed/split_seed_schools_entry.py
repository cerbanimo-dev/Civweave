#!/usr/bin/env python3
"""Apply audited legacy-title school routing before running the category splitter."""
from __future__ import annotations

import split_seed_schools as splitter

LEGACY_HEADING_BY_TITLE = {
    "Aluminium": "Science",
    "Alps": "Geography",
    "Alcoholism": "Health, medicine and disease",
    "Acid–base reaction": "Science",
    "Combinatorics": "Mathematics",
    "Carl Linnaeus": "People",
    "Epic poetry": "Arts",
    "Friedrich Nietzsche": "People",
    "History of film": "History",
    "Great Lakes": "Geography",
    "Great Pyramid of Giza": "History",
    "Genetic engineering": "Technology",
    "Glacier": "Geography",
    "Herodotus": "People",
    "History of India": "History",
    "History of Oceania": "History",
    "Indo-European languages": "Society and social sciences",
    "Western imperialism in Asia": "History",
    "James Cook": "People",
    "Jet engine": "Technology",
    "Joan of Arc": "People",
    "Marco Polo": "People",
    "Miguel de Cervantes": "People",
    "Momentum": "Science",
    "NATO": "Society and social sciences",
    "Netherlands": "Geography",
    "Nuclear weapon": "Technology",
    "Opera": "Arts",
    "Orbit": "Science",
    "Olympic Games": "Everyday life",
    "Piano": "Arts",
    "Phosphorus": "Science",
    "Paul the Apostle": "People",
    "Rail transport": "Technology",
    "Taiwan": "Geography",
    "Roald Amundsen": "People",
    "Sex": "Everyday life",
    "Sulfur": "Science",
    "Talmud": "Philosophy and religion",
    "Ukraine": "Geography",
    "Zheng He": "People",
    "Philosophy of science": "Philosophy and religion",
    "Tornado": "Science",
    "History of East Asia": "History",
    "Semiconductor device": "Technology",
    "Fairy tale": "Arts",
    "Vasco da Gama": "People",
    "Space station": "Technology",
    "European colonization of the Americas": "History",
    "Calligraphy": "Arts",
    "Hatshepsut": "People",
    "Soybean": "Science",
    "Redox": "Science",
    "United Arab Emirates": "Geography",
    "Suffrage": "Society and social sciences",
    "Great Barrier Reef": "Geography",
    "Green Revolution": "Technology",
    "Lake Victoria": "Geography",
    "Emmy Noether": "People",
    "Frida Kahlo": "People",
    "Bow and arrow": "Technology",
    "Nth root": "Mathematics",
    "Welfare": "Society and social sciences",
    "Employment": "Society and social sciences",
    "Prehistoric art": "Arts",
    "Skeletal muscle": "Science",
    "History of the Middle East": "History",
    "Stove": "Technology",
    "Greek alphabet": "Society and social sciences",
    "Environmentalism": "Society and social sciences",
    "Great Wall of China": "History",
    "Early human migrations": "History",
    "English literature": "Arts",
    "Conic section": "Mathematics",
    "Heat": "Science",
    "Ferdinand Magellan": "People",
    "Southern Ocean": "Geography",
    "News": "Society and social sciences",
    "Thomas Aquinas": "People",
    "Late modern period": "History",
}

_original_fetch_assignments = splitter.fetch_assignments


def fetch_assignments_with_legacy_routing(articles, url):
    assignments, audit = _original_fetch_assignments(articles, url)
    applied = []
    unresolved = []
    for article in articles:
        article_id = article["id"]
        if assignments[article_id]["school_slug"] != "crossroads":
            continue
        heading = LEGACY_HEADING_BY_TITLE.get(article["title"])
        if heading is None:
            unresolved.append(article["title"])
            continue
        assignments[article_id] = {
            "heading": heading,
            "school_name": splitter.SCHOOL_NAMES[heading],
            "school_slug": splitter.slugify(heading),
            "subdomain": "Legacy Level 3 placement",
        }
        applied.append({"title": article["title"], "school_slug": splitter.slugify(heading)})
    audit["legacy_override_count"] = len(applied)
    audit["legacy_overrides"] = applied
    audit["crossroads_articles_before_overrides"] = audit.get("crossroads_articles", 0)
    audit["crossroads_articles"] = len(unresolved)
    audit["crossroads_titles"] = unresolved
    return assignments, audit


splitter.fetch_assignments = fetch_assignments_with_legacy_routing
raise SystemExit(splitter.main())

#!/usr/bin/env python3
"""Run title-quality v2 with deterministic exclusions for known subject-word collisions."""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path

BASE = Path(__file__).with_name("filter-open-learning-media-title-quality-v2.py")

spec = importlib.util.spec_from_file_location("open_media_title_quality_v2", BASE)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load {BASE}")
quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)

ORIGINAL = quality.title_supports_topic

TAROT_GAME = re.compile(r"\b(?:game gear|video game|gameplay|playthrough|walkthrough|let'?s play)\b", re.I)
PARENTING_SOFTWARE = re.compile(r"\b(?:blender|3d|rigging|armature|object parenting|bone parenting|animation fundamentals)\b", re.I)
PARENTING_HUMAN = re.compile(r"\b(?:parenting|parenthood|gentle parent|caregiv|child development|children|family care|co[- ]regulation)\b", re.I)
GARDENING_SOFTWARE = re.compile(r"\b(?:emacs|software|windows user|coding|programming|configuration)\b", re.I)
GARDENING_PLANTS = re.compile(r"\b(?:garden|gardening|plant|soil|vegetable|horticultur|compost|seedling)\b", re.I)
WOODWORKING_COMMERCE = re.compile(r"\b(?:amazon|content policy|listing rejected|seo|marketplace policy)\b", re.I)
WOODWORKING_CRAFT = re.compile(r"\b(?:woodwork|carpentry|joinery|woodworking tool|lumber|timber|oak|saw|chisel)\b", re.I)


def collision_safe(slug: str, title: str) -> bool:
    if not ORIGINAL(slug, title):
        return False
    if slug == "tarot-symbolism" and TAROT_GAME.search(title):
        return False
    if slug == "parenting-caregiving" and PARENTING_SOFTWARE.search(title) and not PARENTING_HUMAN.search(title):
        return False
    if slug == "gardening-plants" and GARDENING_SOFTWARE.search(title):
        # "Gardening in Emacs" is a software metaphor, not plant care.
        return False
    if slug == "woodworking-basics" and WOODWORKING_COMMERCE.search(title) and not WOODWORKING_CRAFT.search(title):
        return False
    return True


quality.title_supports_topic = collision_safe
quality.main()

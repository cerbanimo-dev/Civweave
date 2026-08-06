#!/usr/bin/env python3
"""Extract irregular visual assets from generated contact sheets.

The sheet grid only identifies an asset's neighborhood. Final exports are
trimmed from a content alpha mask, so neighboring frames/corners cannot leak
into the result and non-square assets retain their natural proportions.
"""
from pathlib import Path
import argparse
import json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


SHEETS = {
    "fellowfare-assets.png": (4, 3, [
        "button-copper", "button-brass", "button-teal", "button-legendary",
        "button-stack-small", "button-stack-tall", "button-pouch", "button-purse",
        "button-sparkle", "button-reward-burst", "button-balance-medallion", "button-payment-token",
    ]),
    "fellowfare-assets-2.png": (4, 3, [
        "sign-browse", "sign-listing", "sign-trade", "sign-vault",
        "orders-bell", "favorites-pinboard", "search-magnifier", "filter-funnel",
        "merchant-ledger", "parcel-crate", "price-placard-empty", "fellowfare-emblem-prop",
    ]),
    "rook-new.png": (3, 2, [
        "rook-welcome", "rook-button", "rook-ledger",
        "rook-point-shop", "rook-celebrate", "rook-listen",
    ]),
    "07-kamiya-pose-sheet.png": (3, 2, [
        "kamiya-welcoming", "kamiya-thinking", "kamiya-troubleshooting",
        "kamiya-celebrating", "kamiya-focused", "kamiya-handoff-received",
    ]),
    "cerbanimo-icons.png": (8, 3, [
        "state-new-task", "state-system", "state-completed", "state-blocked", "state-needs-input", "state-handoff", "state-reviewed", "state-ready-build",
        "notification-bell", "notification-dot", "inbox", "connection-online", "connection-offline", "local-storage", "api-provider-key", "model-selector",
        "loading-circuit", "success-sparkle", "warning-lamp", "error-crystal", "drag-handle", "hotspot-halo", "unread-dot",
    ]),
    "cerbanimo-icons-2.png": (4, 4, [
        "close", "confirm", "backstep", "inspect-open",
        "edit-blueprint", "add-create", "resume-mission", "mission-details",
        "universal-form", "object-viewer", "talk-kamiya", "realm-handoff",
        "state-ring-active", "state-ring-selected", "state-ring-disabled",
    ]),
    "cerbanimo-icons-and-nav-tray.png": (5, 3, [
        "cerbanimo-home", "civweave-home", "universal-ai-config", "settings", "ask-kamiya",
        "back-door", "map", "tray-left-cap", "tray-active-slot", "tray-right-cap",
        "bottom-nav-tray",
    ]),
    "civweave-navigation-icons.png": (4, 2, [
        "civweave-home", "civweave-route", "weaveling-compass", "civweave-journal",
        "civweave-passport", "civweave-realms", "civweave-ai-config",
    ]),
    "civweave-navbar.png": (3, 1, [
        "nav-orbit-left", "civweave-bottom-navbar", "nav-orbit-right",
    ]),
    "ChatGPT Image Aug 1, 2026, 03_02_20 PM (1).png": (3, 2, [
        "merlin-welcome-guide", "merlin-conversation-listening", "merlin-proposal-forge",
        "merlin-conflict-map", "merlin-consent-decision", "merlin-automation-execution",
    ]),
    "ChatGPT Image Aug 1, 2026, 03_02_20 PM (2).png": (4, 3, [
        "commons-hall", "active-plan", "proposal", "edit-plan",
        "objection", "idea", "assembly", "evidence-review",
        "consent-recorded", "consent-blocked", "federation", "execution-accepted",
    ]),
    "ChatGPT Image Aug 1, 2026, 03_02_21 PM (3).png": (4, 3, [
        "delegation-token", "anarchadia-token", "trigger-sensor", "schedule-clock",
        "condition-switch", "approval-gate", "consent-console", "agent-capsule",
        "dependency-map", "audit-ledger", "handoff-portal", "rollback-control",
    ]),
    "ChatGPT Image Aug 1, 2026, 03_02_21 PM (4).png": (3, 4, [
        "zine-bulletin-board", "drafting-table", "amendment-placard",
        "debate-table", "evidence-projector", "automation-control-bench", "objection-flag-rack",
        "appeal-podium", "federation-node-map", "execution-dispatch-board", "task-assignment-board", "anarchadia-emblem-stand",
    ]),
    "ChatGPT Image Aug 1, 2026, 03_02_05 PM (8).png": (5, 2, [
        "commons-route", "control-route", "proposal-route", "assembly-route", "consent-route",
        "federation-route", "handoff-route", "model-controls", "settings-route", "return-route",
    ]),
}

# Object centers are measured from the supplied sheets. They are deliberately
# not inferred from square grid cells: disconnected sparkles and props are
# assigned to their nearest object, while neighboring artwork is excluded.
CENTERS = {
    "fellowfare-assets.png": [(.125,.17),(.375,.17),(.625,.17),(.875,.17),(.125,.51),(.375,.51),(.625,.51),(.875,.51),(.125,.84),(.375,.84),(.625,.84),(.875,.84)],
    "fellowfare-assets-2.png": [(.125,.17),(.375,.17),(.625,.17),(.875,.17),(.125,.50),(.375,.50),(.625,.50),(.875,.50),(.125,.83),(.375,.83),(.625,.83),(.875,.83)],
    "rook-new.png": [(.17,.24),(.50,.24),(.83,.24),(.17,.74),(.50,.74),(.83,.74)],
    "07-kamiya-pose-sheet.png": [(.17,.24),(.50,.24),(.83,.24),(.17,.74),(.50,.74),(.83,.74)],
    "cerbanimo-icons.png": [
        (.083,.20),(.205,.20),(.327,.20),(.450,.20),(.572,.20),(.694,.20),(.815,.20),(.935,.20),
        (.075,.50),(.139,.44),(.238,.49),(.372,.49),(.510,.49),(.648,.49),(.775,.49),(.918,.49),
        (.085,.75),(.260,.75),(.405,.75),(.525,.75),(.655,.75),(.790,.75),(.928,.75),
    ],
    "cerbanimo-icons-2.png": [
        (.17,.14),(.375,.14),(.585,.14),(.795,.14),
        (.17,.39),(.375,.39),(.585,.39),(.795,.39),
        (.17,.64),(.375,.64),(.585,.64),(.795,.64),
        (.26,.87),(.49,.87),(.70,.87),
    ],
    "cerbanimo-icons-and-nav-tray.png": [
        (.15,.18),(.32,.18),(.50,.18),(.68,.18),(.85,.18),
        (.16,.49),(.34,.49),(.50,.49),(.68,.49),(.86,.49),
        (.50,.82),
    ],
    "civweave-navigation-icons.png": [(.14,.24),(.38,.24),(.62,.24),(.86,.24),(.19,.72),(.50,.72),(.81,.72)],
    "civweave-navbar.png": [(.12,.24),(.50,.67),(.88,.24)],
    "ChatGPT Image Aug 1, 2026, 03_02_20 PM (1).png": [(.17,.25),(.50,.25),(.83,.25),(.17,.75),(.50,.75),(.83,.75)],
    "ChatGPT Image Aug 1, 2026, 03_02_20 PM (2).png": [(.125,.17),(.375,.17),(.625,.17),(.875,.17),(.125,.50),(.375,.50),(.625,.50),(.875,.50),(.125,.83),(.375,.83),(.625,.83),(.875,.83)],
    "ChatGPT Image Aug 1, 2026, 03_02_21 PM (3).png": [(.125,.17),(.375,.17),(.625,.17),(.875,.17),(.125,.50),(.375,.50),(.625,.50),(.875,.50),(.125,.83),(.375,.83),(.625,.83),(.875,.83)],
    "ChatGPT Image Aug 1, 2026, 03_02_21 PM (4).png": [(.17,.12),(.50,.12),(.83,.12),(.24,.35),(.73,.35),(.25,.55),(.75,.55),(.25,.72),(.75,.72),(.17,.90),(.50,.90),(.83,.90)],
    "ChatGPT Image Aug 1, 2026, 03_02_05 PM (8).png": [(.10,.25),(.30,.25),(.50,.25),(.70,.25),(.90,.25),(.10,.75),(.30,.75),(.50,.75),(.70,.75),(.90,.75)],
}


def alpha_from_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    data = np.asarray(rgba).copy()
    if np.any(data[:, :, 3] < 250):
        return rgba
    rgb = data[:, :, :3].astype(np.int16)
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    key = np.median(border, axis=0)
    # The supplied key sheets use a bright green with a broad lighting
    # gradient. Green-dominance is therefore more reliable than distance from
    # one sampled RGB value and avoids leaving opaque square corners.
    if key[1] > key[0] * 1.35 and key[1] > key[2] * 1.35:
        dominance = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
        alpha = np.clip((118 - dominance) * (255 / 74), 0, 255).astype(np.uint8)
    else:
        distance = np.sqrt(np.sum((rgb - key) ** 2, axis=2))
        alpha = np.clip((distance - 24) * (255 / 70), 0, 255).astype(np.uint8)
    alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.65)))
    data[:, :, 3] = alpha
    return Image.fromarray(data, "RGBA")


def trim_cell(sheet: Image.Image, box, padding=10):
    cell = sheet.crop(box)
    alpha = np.asarray(cell.getchannel("A"))
    ys, xs = np.where(alpha > 22)
    if not len(xs):
        return None
    left = max(0, int(xs.min()) - padding)
    top = max(0, int(ys.min()) - padding)
    right = min(cell.width, int(xs.max()) + padding + 1)
    bottom = min(cell.height, int(ys.max()) + padding + 1)
    return cell.crop((left, top, right, bottom))


def extract_by_components(source: Path, target: Path, names, centers):
    sheet = alpha_from_background(Image.open(source))
    alpha = np.asarray(sheet.getchannel("A"))
    labels, count = ndimage.label(alpha > 24)
    objects = ndimage.find_objects(labels)
    assignments = [[] for _ in centers]
    for component_id, region in enumerate(objects, start=1):
        if region is None:
            continue
        ys, xs = region
        mask = labels[region] == component_id
        area = int(mask.sum())
        if area < 10:
            continue
        cy = (ys.start + ys.stop - 1) / 2 / sheet.height
        cx = (xs.start + xs.stop - 1) / 2 / sheet.width
        nearest = min(range(len(centers)), key=lambda i: (cx-centers[i][0])**2 + (cy-centers[i][1])**2)
        assignments[nearest].append(component_id)

    target.mkdir(parents=True, exist_ok=True)
    records = []
    for index, name in enumerate(names):
        if not name or index >= len(assignments):
            continue
        keep = np.isin(labels, assignments[index])
        ys, xs = np.where(keep)
        if not len(xs):
            continue
        pad = 12
        left, top = max(0, int(xs.min())-pad), max(0, int(ys.min())-pad)
        right, bottom = min(sheet.width, int(xs.max())+pad+1), min(sheet.height, int(ys.max())+pad+1)
        data = np.asarray(sheet.crop((left, top, right, bottom))).copy()
        data[:, :, 3] = np.where(keep[top:bottom, left:right], data[:, :, 3], 0)
        asset = Image.fromarray(data, "RGBA")
        out = target / f"{name}.png"
        temporary = out.with_suffix(".part.png")
        asset.save(temporary, compress_level=6)
        temporary.replace(out)
        records.append({"file": out.name, "width": asset.width, "height": asset.height})
    return records


def extract_grid(source: Path, target: Path, cols: int, rows: int, names):
    sheet = alpha_from_background(Image.open(source))
    target.mkdir(parents=True, exist_ok=True)
    records = []
    for index, name in enumerate(names):
        if not name:
            continue
        col, row = index % cols, index // cols
        x0, x1 = round(col * sheet.width / cols), round((col + 1) * sheet.width / cols)
        y0, y1 = round(row * sheet.height / rows), round((row + 1) * sheet.height / rows)
        # Stay inside the visual gutters; the cell only locates the object.
        # Alpha trimming below determines the final non-square export bounds.
        gutter_x = max(4, round((x1 - x0) * .018))
        gutter_y = max(4, round((y1 - y0) * .018))
        x0, x1 = x0 + gutter_x, x1 - gutter_x
        y0, y1 = y0 + gutter_y, y1 - gutter_y
        asset = trim_cell(sheet, (x0, y0, x1, y1))
        if asset is None:
            continue
        out = target / f"{name}.png"
        temporary = out.with_suffix(".tmp.png")
        asset.save(temporary, optimize=True)
        temporary.replace(out)
        records.append({"file": out.name, "width": asset.width, "height": asset.height})
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("target")
    args = parser.parse_args()
    source, target = Path(args.source), Path(args.target)
    manifest = {}
    for filename, (cols, rows, names) in SHEETS.items():
        path = source / filename
        if not path.exists():
            continue
        group = filename.rsplit(".", 1)[0]
        if filename in CENTERS:
            manifest[group] = extract_by_components(path, target / group, names, CENTERS[filename])
        else:
            manifest[group] = extract_grid(path, target / group, cols, rows, names)
    (target / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()

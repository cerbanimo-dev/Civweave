from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SELF = ROOT / "scripts" / "civweave-total-rename.py"
NEW_WORKFLOW = ROOT / ".github" / "workflows" / "civweave-total-rename.yml"
BRIDGE_WORKFLOW = ROOT / ".github" / "workflows" / "verify-version-bump.yml"
PLAN = ROOT / "CIVWEAVE-TOTAL-RENAME-PLAN.md"

OLD_LOWER = "common" + "weave"
OLD_TITLE = "Common" + "weave"
OLD_UPPER = "COMMON" + "WEAVE"
NEW_LOWER = "civweave"
NEW_TITLE = "Civweave"
NEW_UPPER = "CIVWEAVE"

REPLACEMENTS = (
    (OLD_UPPER, NEW_UPPER),
    (OLD_TITLE, NEW_TITLE),
    (OLD_LOWER, NEW_LOWER),
)


def run(*args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        args,
        cwd=ROOT,
        check=check,
        capture_output=capture,
    )


def tracked_paths() -> list[Path]:
    result = run("git", "ls-files", "-z", capture=True)
    return [ROOT / raw.decode("utf-8") for raw in result.stdout.split(b"\0") if raw]


def replace_identifier(value: str) -> str:
    updated = value
    for old, new in REPLACEMENTS:
        updated = updated.replace(old, new)
    return updated


def renamed_relative_path(relative: Path) -> Path:
    return Path(replace_identifier(str(relative)))


def looks_textual(data: bytes) -> bool:
    if b"\0" in data:
        return False
    try:
        data.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def rename_paths(paths: list[Path]) -> tuple[int, list[str]]:
    planned: list[tuple[Path, Path]] = []
    for source in paths:
        relative = source.relative_to(ROOT)
        target_relative = renamed_relative_path(relative)
        if target_relative != relative:
            planned.append((source, ROOT / target_relative))

    renamed = 0
    canonical_collisions: list[str] = []
    for source, target in sorted(planned, key=lambda pair: len(pair[0].parts), reverse=True):
        if not source.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            same = source.read_bytes() == target.read_bytes()
            image_collision = source.suffix.lower() in {
                ".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"
            }
            if same or image_collision:
                run("git", "rm", "--", str(source.relative_to(ROOT)))
                canonical_collisions.append(str(target.relative_to(ROOT)))
                continue
            raise RuntimeError(
                f"Unsafe rename collision: {source.relative_to(ROOT)} -> {target.relative_to(ROOT)}"
            )
        run(
            "git",
            "mv",
            "--",
            str(source.relative_to(ROOT)),
            str(target.relative_to(ROOT)),
        )
        renamed += 1
    return renamed, canonical_collisions


def rewrite_text_files(paths: list[Path]) -> tuple[int, int]:
    files_changed = 0
    replacements = 0
    for path in paths:
        if not path.is_file() or path in {SELF, NEW_WORKFLOW}:
            continue
        data = path.read_bytes()
        if not looks_textual(data):
            continue
        text = data.decode("utf-8")
        updated = text
        local_replacements = 0
        for old, new in REPLACEMENTS:
            count = updated.count(old)
            if count:
                updated = updated.replace(old, new)
                local_replacements += count
        if updated != text:
            path.write_bytes(updated.encode("utf-8"))
            files_changed += 1
            replacements += local_replacements
    return files_changed, replacements


def bump_release() -> str:
    version_path = ROOT / "VERSION"
    current = version_path.read_text(encoding="utf-8").strip()
    parts = current.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise RuntimeError(f"Invalid VERSION: {current}")
    major, minor, patch = map(int, parts)
    next_version = f"{major}.{minor}.{patch + 1}"
    version_path.write_text(next_version + "\n", encoding="utf-8")

    package_path = ROOT / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    package["version"] = next_version
    package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

    lock_path = ROOT / "package-lock.json"
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        if "version" in lock:
            lock["version"] = next_version
        if isinstance(lock.get("packages"), dict) and isinstance(lock["packages"].get(""), dict):
            lock["packages"][""]["version"] = next_version
        lock_path.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    return next_version


def synchronize_release() -> None:
    for script in (
        ROOT / "scripts" / "sync-release-version-assets.mjs",
        ROOT / "scripts" / "sync-release-coherence-v220.mjs",
    ):
        if script.exists():
            run("node", str(script.relative_to(ROOT)))


def restore_version_workflow() -> None:
    source = run(
        "git",
        "show",
        "origin/main:.github/workflows/verify-version-bump.yml",
        capture=True,
    ).stdout.decode("utf-8")
    BRIDGE_WORKFLOW.write_text(replace_identifier(source), encoding="utf-8")


def write_report(
    files_changed: int,
    replacements: int,
    paths_renamed: int,
    collisions: list[str],
    release_version: str,
) -> None:
    report = ROOT / "CIVWEAVE-TOTAL-RENAME.md"
    collision_lines = "\n".join(f"- `{item}`" for item in collisions) or "- None"
    report.write_text(
        "# Civweave total rename\n\n"
        "This migration replaces the former platform identifier throughout tracked source, configuration, documentation, tests, and GitHub Actions. Tracked paths were renamed in the same pass, so imports and verification references move together.\n\n"
        f"- Release: {release_version}\n"
        f"- Text files changed: {files_changed}\n"
        f"- Text replacements: {replacements}\n"
        f"- Tracked paths renamed: {paths_renamed}\n\n"
        "## Canonical asset collisions\n\n"
        "Where an older image path mapped onto an already-present Civweave asset, the Civweave asset won and the older duplicate was removed.\n\n"
        f"{collision_lines}\n\n"
        "## External deployment names\n\n"
        "Repository code now uses Civweave for Worker and Pages configuration values, workflow labels, and check names. Existing Cloudflare dashboard service/project records are external resources and must be renamed or recreated in Cloudflare separately.\n",
        encoding="utf-8",
    )


def remove_scaffold() -> None:
    for path in (SELF, NEW_WORKFLOW, PLAN):
        if path.exists():
            path.unlink()


def assert_no_former_identifier() -> None:
    path_scan = run("git", "ls-files", "-z", capture=True).stdout.decode("utf-8")
    if OLD_LOWER.casefold() in path_scan.casefold():
        offenders = [line for line in path_scan.split("\0") if OLD_LOWER.casefold() in line.casefold()]
        raise RuntimeError(f"Former identifier remains in tracked paths: {offenders[:20]}")

    grep = run(
        "git",
        "grep",
        "-I",
        "-n",
        "-i",
        "--",
        OLD_LOWER,
        capture=True,
        check=False,
    )
    if grep.returncode not in (0, 1):
        raise RuntimeError(grep.stderr.decode("utf-8", errors="replace"))
    if grep.returncode == 0 and grep.stdout:
        raise RuntimeError(
            "Former identifier remains in tracked text:\n"
            + grep.stdout.decode("utf-8", errors="replace")[:12000]
        )


def main() -> None:
    initial_paths = tracked_paths()
    paths_renamed, collisions = rename_paths(initial_paths)
    files_changed, replacements = rewrite_text_files(tracked_paths())
    release_version = bump_release()
    synchronize_release()
    second_files, second_replacements = rewrite_text_files(tracked_paths())
    files_changed += second_files
    replacements += second_replacements
    restore_version_workflow()
    write_report(files_changed, replacements, paths_renamed, collisions, release_version)
    remove_scaffold()
    run("git", "add", "-A")
    assert_no_former_identifier()

    print(
        json.dumps(
            {
                "ok": True,
                "brand": NEW_TITLE,
                "release": release_version,
                "filesChanged": files_changed,
                "replacements": replacements,
                "pathsRenamed": paths_renamed,
                "canonicalAssetCollisions": collisions,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

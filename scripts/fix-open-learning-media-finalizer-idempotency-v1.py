#!/usr/bin/env python3
"""Make the Open Learning Media core finalizer composition-idempotent.

The core finalizer is followed by range and safety finalizers. A full launch-finalization
cycle must therefore be safe to run repeatedly even after those later layers have added
helpers, async declarations, or policy metadata.
"""
from pathlib import Path

PATH = Path('scripts/finalize-open-learning-media-launch-v1.py')

OPTIONAL_OLD = '''    text = replace_once(
        text,
        "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/install-boundary-v146.js',",
        "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/open-learning-media-cache-v1.mjs',\\n  '/app/open-learning-media-installer-v1.mjs',\\n  '/downloads/knowledge-schools/open-learning-media/lookup.json',\\n  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',\\n  '/app/install-boundary-v146.js',",
        "open media optional shell assets",
    )
'''

OPTIONAL_NEW = '''    if "'/app/open-learning-media-cache-v1.mjs'" not in text:
        marker = "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/install-boundary-v146.js',"
        replacement = "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/open-learning-media-cache-v1.mjs',\\n  '/app/open-learning-media-installer-v1.mjs',\\n  '/downloads/knowledge-schools/open-learning-media/lookup.json',\\n  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',\\n  '/app/install-boundary-v146.js',"
        if marker not in text:
            raise RuntimeError("open media optional shell assets: expected marker not found")
        text = text.replace(marker, replacement, 1)
'''

PREFETCH_OLD = '''    start = text.index("export async function prefetchTopic(")
    end = text.index("function safeManifestRecord(", start)
'''

PREFETCH_NEW = '''    prefetch_marker = "function compactFileBytes(" if "function compactFileBytes(" in text else "export async function prefetchTopic("
    start = text.index(prefetch_marker)
    end = text.index("function safeManifestRecord(", start)
'''

BINARY_OLD = '''    start = text.index("function handleBinary(")
    end = text.index("async function handleMediaMessage(", start)
'''

BINARY_NEW = '''    binary_marker = "async function handleBinary(" if "async function handleBinary(" in text else "function handleBinary("
    start = text.index(binary_marker)
    end = text.index("async function handleMediaMessage(", start)
'''


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f'Expected {label} block was not found in the core finalizer.')
    return text.replace(old, new, 1)


def main() -> None:
    text = PATH.read_text()
    text = replace_required(text, OPTIONAL_OLD, OPTIONAL_NEW, 'optional-shell')
    text = replace_required(text, PREFETCH_OLD, PREFETCH_NEW, 'prefetch helper boundary')
    text = replace_required(text, BINARY_OLD, BINARY_NEW, 'async binary-handler boundary')
    PATH.write_text(text)
    print('Open Learning Media core finalizer is composition-idempotent across shell, prefetch, and async mesh layers.')


if __name__ == '__main__':
    main()

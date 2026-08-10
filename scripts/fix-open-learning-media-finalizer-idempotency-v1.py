#!/usr/bin/env python3
"""Make the Open Learning Media core finalizer tolerant of safety-layer additions.

The safety finalizer inserts revocations.json into the optional-shell block. The core
finalizer must therefore detect that its own assets are already present structurally,
rather than requiring its original contiguous block to remain byte-for-byte unchanged.
"""
from pathlib import Path

PATH = Path('scripts/finalize-open-learning-media-launch-v1.py')

OLD = '''    text = replace_once(
        text,
        "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/install-boundary-v146.js',",
        "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/open-learning-media-cache-v1.mjs',\\n  '/app/open-learning-media-installer-v1.mjs',\\n  '/downloads/knowledge-schools/open-learning-media/lookup.json',\\n  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',\\n  '/app/install-boundary-v146.js',",
        "open media optional shell assets",
    )
'''

NEW = '''    if "'/app/open-learning-media-cache-v1.mjs'" not in text:
        marker = "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/install-boundary-v146.js',"
        replacement = "const OPTIONAL_SHELL_ASSETS = [\\n  '/app/open-learning-media-cache-v1.mjs',\\n  '/app/open-learning-media-installer-v1.mjs',\\n  '/downloads/knowledge-schools/open-learning-media/lookup.json',\\n  '/downloads/knowledge-schools/open-learning-media/harvest-policy.json',\\n  '/app/install-boundary-v146.js',"
        if marker not in text:
            raise RuntimeError("open media optional shell assets: expected marker not found")
        text = text.replace(marker, replacement, 1)
'''


def main() -> None:
    text = PATH.read_text()
    if NEW in text:
        print('Open Learning Media core finalizer is already composition-idempotent.')
        return
    if OLD not in text:
        raise RuntimeError('Expected core optional-shell finalizer block was not found.')
    PATH.write_text(text.replace(OLD, NEW, 1))
    print('Open Learning Media core finalizer now tolerates safety-layer shell additions.')


if __name__ == '__main__':
    main()

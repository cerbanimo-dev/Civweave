#!/usr/bin/env python3
"""Keep the launch five-topic Open Learning Media pack inside the Learning Path profile.

The curated launch seed's smallest redistributable variant in each required topic totals
about 397 MiB. The original 384 MiB nominal profile could therefore never satisfy its own
Focus Pack promise. Raise the nominal profile to 448 MiB while retaining the runtime's
45% browser-quota ceiling and per-item automatic-download limits.
"""
from pathlib import Path

RUNTIME = Path('public/app/open-learning-media-cache-v1.mjs')
DOC = Path('docs/open-learning-media-service-v1.md')
OLD = "'learning-path':{label:'Learning Path',budgetBytes:384*1024*1024,autoPrefetch:true,maxAutomaticItemBytes:48*1024*1024}"
NEW = "'learning-path':{label:'Learning Path',budgetBytes:448*1024*1024,autoPrefetch:true,maxAutomaticItemBytes:48*1024*1024}"


def main() -> None:
    text = RUNTIME.read_text()
    if NEW not in text:
        if OLD not in text:
            raise RuntimeError('Learning Path budget marker was not found.')
        RUNTIME.write_text(text.replace(OLD, NEW, 1))

    if DOC.exists():
        doc = DOC.read_text()
        doc = doc.replace('| Learning Path | 384 MiB | On, compact items only |', '| Learning Path | 448 MiB | On, compact items only |')
        if 'The nominal Learning Path budget is 448 MiB' not in doc:
            marker = 'The effective budget is additionally bounded by browser storage quota.'
            addition = ('The nominal Learning Path budget is 448 MiB so the launch Focus Pack can contain one smallest-known approved item from each of the five required launch topics. '
                        'This is a ceiling, not a reservation: constrained devices still use the smaller browser-quota-derived limit and may report skipped pack items.\n\n')
            if marker in doc:
                doc = doc.replace(marker, addition + marker, 1)
        DOC.write_text(doc)

    print('Open Learning Media Learning Path budget set to 448 MiB with quota cap unchanged.')


if __name__ == '__main__':
    main()

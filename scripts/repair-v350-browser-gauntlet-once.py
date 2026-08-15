from pathlib import Path

path=Path('scripts/browser-installer-gauntlet-v281.mjs')
text=path.read_text()
old="  await installedLaunch.waitForSelector('.campus [data-realm=\"living-school\"]',{state:'attached',timeout:15000});"
new="  assert.equal(await installedLaunch.locator('.campus [data-realm=\"living-school\"]').count()>0,true,'Working Campus realm nodes were not present after installed launch');"
if text.count(old)!=1:
    raise SystemExit(f'expected exactly one unstable realm-node wait, found {text.count(old)}')
path.write_text(text.replace(old,new,1))

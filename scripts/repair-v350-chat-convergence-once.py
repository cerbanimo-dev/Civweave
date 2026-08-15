from pathlib import Path

path=Path('scripts/verify-chat-convergence-v250.mjs')
text=path.read_text()
old="check('family AI loader can delegate opening through the canonical compatibility API',familyLoader.includes('CivweavePersistentGuideChatV215')&&familyLoader.includes('api.open({guide:target,prefill,focus:true})'));"
new="check('family AI loader delegates opening directly to canonical V350 owner',familyLoader.includes('CivweaveGuideChatSurfaceV350')&&familyLoader.includes('owner.open({guide:target,prefill,focus:true})')&&familyLoader.includes('civweave:guide-chat-ready')&&!familyLoader.includes('CivweaveGuideWorkspaceV242'));"
if text.count(old)!=1:
    raise SystemExit(f'expected exactly one stale family-loader convergence assertion, found {text.count(old)}')
path.write_text(text.replace(old,new,1))

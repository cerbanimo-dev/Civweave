#!/usr/bin/env python3
"""Teach the Open Learning Media runtime to infer all generated registry topics."""
from pathlib import Path

PATH = Path("public/app/open-learning-media-cache-v1.mjs")
text = PATH.read_text(encoding="utf-8")

old_hint = "function topicHintScore(query,slug){const hay=clean(query,4000).toLowerCase();let score=0;for(const hint of TOPIC_HINTS[slug]||[])if(hay.includes(hint))score+=hint.includes(' ')?8:3;return score}\nexport function scoreRecord(record,query,topicSlug=''){const queryWords=[...new Set(words(query))].slice(0,32);if(!queryWords.length)return topicSlug?30:0;\n  const title=new Set(words(record?.title)),body=new Set(words(`${record?.description||''} ${record?.attribution?.creator||''}`));\n  let score=topicSlug?topicHintScore(query,topicSlug)+8:0;"
new_hint = "function topicHintsFor(slug,lookup=null){const dynamic=Array.isArray(lookup?.topic_meta?.[slug]?.hints)?lookup.topic_meta[slug].hints:[];return[...new Set([...(TOPIC_HINTS[slug]||[]),...dynamic].map(value=>clean(value,180).toLowerCase()).filter(Boolean))]}\nfunction topicHintScore(query,slug,lookup=null){const hay=clean(query,4000).toLowerCase();let score=0;for(const hint of topicHintsFor(slug,lookup))if(hay.includes(hint))score+=hint.includes(' ')?8:3;return score}\nexport function inferTopicSlug(query,lookup){let bestSlug='',bestHint=0;for(const slug of Object.keys(lookup?.topics||{})){const hint=topicHintScore(query,slug,lookup);if(hint>bestHint){bestHint=hint;bestSlug=slug}}return bestHint>0?bestSlug:''}\nexport function scoreRecord(record,query,topicSlug='',lookup=null){const queryWords=[...new Set(words(query))].slice(0,32);if(!queryWords.length)return topicSlug?30:0;\n  const title=new Set(words(record?.title)),body=new Set(words(`${record?.description||''} ${record?.attribution?.creator||''}`));\n  let score=topicSlug?topicHintScore(query,topicSlug,lookup)+8:0;"

old_candidates = "function candidatesForQuery(lookup,query,{schoolSlug='',topicSlug=''}={}){let inferred=topicSlug;if(!inferred){let bestSlug='',bestHint=0;for(const slug of Object.keys(lookup.topics||{})){const hint=topicHintScore(query,slug);if(hint>bestHint){bestHint=hint;bestSlug=slug}}if(bestHint>0)inferred=bestSlug}const source=inferred?(lookup.topics?.[inferred]||[]):flattenLookup(lookup);return source.map(record=>({...record,topicSlug:inferred||record.topicSlug,recordKey:recordKey(record),_score:scoreRecord(record,query,inferred)})).filter(record=>isRedistributable(record)&&record._score>=MIN_RELEVANCE_SCORE).sort((a,b)=>b._score-a._score||Number(b.quality_score||0)-Number(a.quality_score||0))}"
new_candidates = "function candidatesForQuery(lookup,query,{schoolSlug='',topicSlug=''}={}){const inferred=topicSlug||inferTopicSlug(query,lookup);const source=inferred?(lookup.topics?.[inferred]||[]):flattenLookup(lookup);return source.map(record=>({...record,topicSlug:inferred||record.topicSlug,recordKey:recordKey(record),_score:scoreRecord(record,query,inferred,lookup)})).filter(record=>isRedistributable(record)&&record._score>=MIN_RELEVANCE_SCORE).sort((a,b)=>b._score-a._score||Number(b.quality_score||0)-Number(a.quality_score||0))}"

if new_hint not in text:
    if old_hint not in text:
        raise SystemExit("topic hint anchor not found")
    text = text.replace(old_hint, new_hint, 1)
if new_candidates not in text:
    if old_candidates not in text:
        raise SystemExit("candidate inference anchor not found")
    text = text.replace(old_candidates, new_candidates, 1)

PATH.write_text(text, encoding="utf-8")
print("Open Learning Media topic inference is registry-driven.")

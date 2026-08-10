#!/usr/bin/env python3
"""Teach the Open Learning Media runtime to infer all generated registry topics."""
from pathlib import Path

PATH = Path("public/app/open-learning-media-cache-v1.mjs")
text = PATH.read_text(encoding="utf-8")

new_scoring = """function topicHintsFor(slug,lookup=null){const dynamic=Array.isArray(lookup?.topic_meta?.[slug]?.hints)?lookup.topic_meta[slug].hints:[];return[...new Set([...(TOPIC_HINTS[slug]||[]),...dynamic].map(value=>clean(value,180).toLowerCase()).filter(Boolean))]}
function topicHintScore(query,slug,lookup=null){const hay=clean(query,4000).toLowerCase();let score=0;for(const hint of topicHintsFor(slug,lookup))if(hay.includes(hint))score+=hint.includes(' ')?8:3;return score}
export function inferTopicSlug(query,lookup){let bestSlug='',bestHint=0;for(const slug of Object.keys(lookup?.topics||{})){const hint=topicHintScore(query,slug,lookup);if(hint>bestHint){bestHint=hint;bestSlug=slug}}return bestHint>0?bestSlug:''}
export function scoreRecord(record,query,topicSlug='',lookup=null){
  const queryWords=[...new Set(words(query))].slice(0,32);if(!queryWords.length)return topicSlug?30:0;
  const title=new Set(words(record?.title)),body=new Set(words(`${record?.description||''} ${record?.attribution?.creator||''}`));
  let score=topicSlug?topicHintScore(query,topicSlug,lookup)+8:0;
  for(const word of queryWords){if(title.has(word))score+=6;else if(body.has(word))score+=2}
  score+=Math.min(10,Math.round((Number(record?.quality_score)||0)/10));
  return score;
}"""

new_candidates = "function candidatesForQuery(lookup,query,{schoolSlug='',topicSlug=''}={}){const inferred=topicSlug||inferTopicSlug(query,lookup);const source=inferred?(lookup.topics?.[inferred]||[]):flattenLookup(lookup);return source.map(record=>({...record,topicSlug:inferred||record.topicSlug,recordKey:recordKey(record),_score:scoreRecord(record,query,inferred,lookup)})).filter(record=>isRedistributable(record)&&record._score>=MIN_RELEVANCE_SCORE).sort((a,b)=>b._score-a._score||Number(b.quality_score||0)-Number(a.quality_score||0))}"

if "function topicHintsFor(slug,lookup=null)" not in text:
    start = text.find("function topicHintScore(query,slug)")
    end = text.find("\n\nasync function cacheJson", start)
    if start < 0 or end < 0:
        raise SystemExit("topic scoring anchor not found")
    text = text[:start] + new_scoring + text[end:]

if new_candidates not in text:
    start = text.find("function candidatesForQuery(")
    end = text.find("\nasync function peerForRecordKey", start)
    if start < 0 or end < 0:
        raise SystemExit("candidate inference anchor not found")
    text = text[:start] + new_candidates + text[end:]

if "chooseFile,inferTopicSlug,scoreRecord" not in text:
    if "chooseFile,scoreRecord" not in text:
        raise SystemExit("runtime API anchor not found")
    text = text.replace("chooseFile,scoreRecord", "chooseFile,inferTopicSlug,scoreRecord", 1)

PATH.write_text(text, encoding="utf-8")
print("Open Learning Media topic inference is registry-driven.")

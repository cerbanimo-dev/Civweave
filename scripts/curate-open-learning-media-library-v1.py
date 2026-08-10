#!/usr/bin/env python3
"""Curate the expanded Open Learning Media catalog with registry-driven relevance and pedagogy gates."""
from __future__ import annotations
import json, re
from collections import Counter
from pathlib import Path

ROOT=Path("public/downloads/knowledge-schools/open-learning-media")
REGISTRY_PATH=Path("config/open-learning-media-packs-v1.json")
CATALOG_PATH=ROOT/"catalog.json"; SUMMARY_PATH=ROOT/"summary.json"; LOOKUP_PATH=ROOT/"lookup.json"
TEACHING_SIGNAL=re.compile(r"\b(?:teach|teaching|learn|learning|lesson|lecture|course|classroom|student|tutorial|guide|workshop|training|education|educational|introduction|intro|overview|demonstration|demo|walkthrough|how[- ]to|explained|explanation|basics|beginner|fundamentals|seminar|presentation|conference|symposium|webinar|speaker series|high school|grade|for all)\b",re.I)
EDUCATIONAL=re.compile(r"\b(?:teach|teaching|learn|learning|lesson|lecture|course|classroom|student|tutorial|guide|workshop|training|education|educational|curriculum|explain|explained|explanation|introduction|intro|overview|demonstration|demo|example|walkthrough|how[- ]to|presentation|conference|symposium|webinar|seminar|method|framework|technique|practice|basics|beginner|fundamentals|speaker series|high school|grade|for all|documentary|museum talk|museum lecture|gallery talk|cultural heritage)\b",re.I)
TITLE_INSTRUCTIONAL=re.compile(r"\b(?:learn|lesson|lecture|course|tutorial|guide|workshop|training|introduction|intro|overview|demo|walkthrough|how[- ]to|basics|beginner|fundamentals|explained|explanation|understanding|seminar|presentation|conference|symposium|webinar|speaker series|high school|grade|for all|documentary|museum talk|museum lecture|gallery talk)\b",re.I)
CLICKBAIT=re.compile(r"\b(?:breaking|entire .{0,20} in shock|terrible news|can't believe|cannot believe|just destroyed|just received|you won't believe)\b",re.I)
NON_INSTRUCTIONAL=re.compile(r"\b(?:trailer|teaser|music video|full ep|full album|let'?s play|gameplay|asmr|roleplay|reaction video)\b",re.I)
AMBIGUOUS={
  "physics-foundations":{"energy","electricity"},
  "cooking-food-safety":{"cooking"},
  "woodworking-basics":{"woodworking"},
  "sewing-textiles":{"sewing","textiles"},
  "drawing-design":{"drawing","sketching"},
  "photography-video":{"photography"},
  "statistics-data-literacy":{"statistics","probability"},
}

def norm(value): return re.sub(r"[^a-z0-9]+"," ",str(value or "").lower()).strip()
def hits(phrases,value):
    hay=f" {norm(value)} "; out=[]
    for phrase in phrases or []:
        needle=norm(phrase)
        if needle and f" {needle} " in hay: out.append(phrase)
    return out
def informative_hits(slug,phrases,value,title=""):
    raw=hits(phrases,value); ambiguous=AMBIGUOUS.get(slug,set())
    if not ambiguous:return raw
    title_teaches=bool(TEACHING_SIGNAL.search(title))
    return [item for item in raw if norm(item) not in ambiguous or title_teaches]
def compact(r):
    keys=["provider","provider_id","title","description","source_url","cache_policy","license","files","quality_score","content_hash","hash_state","attribution","relevance","pedagogy","selection"]
    return {k:(r.get(k) or [] if k=="files" else r.get(k)) for k in keys}

def main():
    registry=json.loads(REGISTRY_PATH.read_text(encoding="utf-8")); topic_list=list(registry.get("topics") or [])
    topics={t["slug"]:t for t in topic_list}; packs=list(registry.get("packs") or [])
    catalog=json.loads(CATALOG_PATH.read_text(encoding="utf-8")); summary=json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    before=list(catalog.get("records") or [])

    relevant=[]; rel_rejected=[]
    for r in before:
        title=str(r.get("title") or ""); body=f"{title} {r.get('description','')}"
        candidates={r.get("topic_slug")}; candidates.update(m.get("topic_slug") for m in r.get("topic_matches") or [] if isinstance(m,dict))
        accepted={}
        for slug in sorted(x for x in candidates if x in topics):
            t=topics[slug]; alias_hits=informative_hits(slug,t.get("aliases"),body,title); concept_hits=hits(t.get("concepts"),body)
            score=10*len(alias_hits)+4*len([x for x in concept_hits if x not in alias_hits])
            if score>=int(t.get("threshold") or 8): accepted[slug]={"score":score,"evidence":alias_hits+concept_hits}
        if accepted: r["relevance"]=accepted; relevant.append(r)
        elif len(rel_rejected)<160: rel_rejected.append({"provider":r.get("provider"),"title":r.get("title"),"topic_slug":r.get("topic_slug")})

    pedagogical=[]; ped_rejected=[]
    for r in relevant:
        title=str(r.get("title") or ""); desc=str(r.get("description") or ""); educational=bool(EDUCATIONAL.search(title+" "+desc)); teaching_title=bool(TEACHING_SIGNAL.search(title)); clickbait=bool(CLICKBAIT.search(title)); noninstructional=bool(NON_INSTRUCTIONAL.search(title)); decisions={}
        for slug in sorted((r.get("relevance") or {}).keys()):
            aliases=topics[slug].get("aliases") or []; title_hits=informative_hits(slug,aliases,title,title); desc_hits=informative_hits(slug,aliases,desc,title)
            ok=not clickbait and not noninstructional and educational and (bool(title_hits) or bool(desc_hits))
            if ok and slug=="vibe-coding" and not re.search(r"\b(?:ai|llm|language model|generative|copilot|claude|gemini|cursor)\b",title+" "+desc,re.I): ok=False
            if not ok: continue
            score=20*len(title_hits)+8*len(desc_hits)+(12 if teaching_title else 0)+(5 if educational else 0)+(6 if r.get("mesh_redistributable") else 0)+min(6,int(r.get("quality_score") or 0)//15)
            decisions[slug]={"strong_title_matches":title_hits,"strong_description_matches":desc_hits,"educational_intent":educational,"instructional_title":teaching_title,"clickbait_title":clickbait,"non_instructional_title":noninstructional,"pedagogy_score":score}
        if decisions: r["pedagogy"]=decisions; pedagogical.append(r)
        elif len(ped_rejected)<160: ped_rejected.append({"provider":r.get("provider"),"title":r.get("title"),"relevance_topics":sorted((r.get("relevance") or {}).keys())})

    kept=[]; sel_rejected=[]
    for r in pedagogical:
        accepted={}; reasons={}
        for slug,e in sorted((r.get("pedagogy") or {}).items()):
            if e.get("strong_title_matches") and e.get("educational_intent"): ok,reason=True,"topic-title-anchor-plus-instructional-evidence"
            elif e.get("strong_description_matches") and TITLE_INSTRUCTIONAL.search(str(r.get("title") or "")): ok,reason=True,"topic-description-anchor-plus-instructional-title"
            else: ok,reason=False,"insufficient-automatic-instructional-evidence"
            reasons[slug]=reason
            if ok: accepted[slug]={"reason":reason,"pedagogy_score":int(e.get("pedagogy_score") or 0)}
        if not accepted:
            if len(sel_rejected)<160: sel_rejected.append({"provider":r.get("provider"),"title":r.get("title"),"reasons":reasons})
            continue
        r["selection"]=accepted; primary=max(accepted,key=lambda s:accepted[s]["pedagogy_score"]); r["topic_slug"]=primary; r["topic_name"]=topics[primary]["name"]; r["school_slug"]=topics[primary]["school_slug"]
        r["topic_matches"]=[{"topic_slug":s,"school_slug":topics[s]["school_slug"],"selection_reason":i["reason"],"pedagogy_score":i["pedagogy_score"],"relevance_score":int(((r.get("relevance") or {}).get(s) or {}).get("score") or 0)} for s,i in sorted(accepted.items(),key=lambda item:(-item[1]["pedagogy_score"],item[0]))]
        kept.append(r)
    kept.sort(key=lambda r:(r.get("topic_slug") or "",-max((m.get("pedagogy_score") or 0) for m in r.get("topic_matches") or [{}]),-int(r.get("quality_score") or 0),(r.get("title") or "").lower()))

    lookup={slug:[] for slug in topics}
    for r in kept:
        if not r.get("mesh_redistributable"): continue
        for m in r.get("topic_matches") or []:
            slug=m.get("topic_slug")
            if slug in lookup: lookup[slug].append(compact(r))
    for slug in lookup: lookup[slug].sort(key=lambda r:(-int(((r.get("selection") or {}).get(slug) or {}).get("pedagogy_score") or 0),-int(r.get("quality_score") or 0),(r.get("title") or "").lower()))

    providers={}
    for provider in sorted({r.get("provider") for r in kept if r.get("provider")}):
        subset=[r for r in kept if r.get("provider")==provider]; providers[provider]={"records":len(subset),"mesh_redistributable":sum(bool(r.get("mesh_redistributable")) for r in subset),"download_candidates":sum(len(r.get("files") or []) for r in subset)}

    topic_stats={}
    for slug,t in topics.items():
        subset=[r for r in kept if slug in (r.get("selection") or {})]; ordered=sorted(subset,key=lambda r:(-int(((r.get("selection") or {}).get(slug) or {}).get("pedagogy_score") or 0),-int(r.get("quality_score") or 0)))
        topic_stats[slug]={"name":t["name"],"school_slug":t["school_slug"],"required":bool(t.get("required")),"records":len(subset),"mesh_redistributable":sum(bool(r.get("mesh_redistributable")) for r in subset),"providers":dict(Counter(r.get("provider") for r in subset)),"top_titles":[r.get("title") for r in ordered[:10]]}

    pack_stats={}; minimum=float(registry.get("minimum_pack_topic_coverage") or .6)
    for p in packs:
        slugs=[s for s in p.get("topics") or [] if s in topics]; covered=[s for s in slugs if topic_stats[s]["mesh_redistributable"]>0]; coverage=len(covered)/len(slugs) if slugs else 0
        record_keys={f"{r.get('provider')}:{r.get('provider_id')}" for r in kept if r.get("mesh_redistributable") and any(s in (r.get("selection") or {}) for s in slugs)}
        pack_stats[p["slug"]]={"name":p["name"],"kind":p.get("kind") or "extension","description":p.get("description") or "","topics":slugs,"covered_topics":covered,"coverage":round(coverage,4),"records":len(record_keys),"available":bool(slugs) and coverage>=(1.0 if p.get("default") else minimum)}

    catalog.update({"record_count_before_relevance_gate":len(before),"record_count_before_pedagogy_gate":len(relevant),"record_count_before_selection_gate":len(pedagogical),"record_count":len(kept),"rejected_by_relevance_gate":len(before)-len(relevant),"rejected_by_pedagogy_gate":len(relevant)-len(pedagogical),"rejected_by_selection_gate":len(pedagogical)-len(kept),"mesh_redistributable_count":sum(bool(r.get("mesh_redistributable")) for r in kept),"download_candidate_count":sum(len(r.get("files") or []) for r in kept),"providers":providers,"focus_topics":topic_stats,"topic_stats":topic_stats,"packs":pack_stats,"pack_registry_revision":registry.get("revision"),"records":kept})
    summary.update({"records_before_relevance_gate":len(before),"records_before_pedagogy_gate":len(relevant),"records_before_selection_gate":len(pedagogical),"records":len(kept),"rejected_by_relevance_gate":len(before)-len(relevant),"rejected_by_pedagogy_gate":len(relevant)-len(pedagogical),"rejected_by_selection_gate":len(pedagogical)-len(kept),"mesh_redistributable":catalog["mesh_redistributable_count"],"download_candidates":catalog["download_candidate_count"],"providers":providers,"focus_topics":topic_stats,"topic_stats":topic_stats,"packs":pack_stats,"pack_registry_revision":registry.get("revision"),"relevance_gate":{"schema":"civweave.open-learning-media-relevance-gate.v3","policy":"Registry aliases/concepts must independently support topic relevance; ambiguous one-word craft/science anchors require an instructional title signal."},"pedagogy_gate":{"schema":"civweave.open-learning-media-pedagogy-gate.v3","policy":"Require topic evidence plus explicit instructional intent; recognize documentary and museum/gallery teaching formats while rejecting clickbait and entertainment-shaped titles."},"selection_gate":{"schema":"civweave.open-learning-media-selection-gate.v3","policy":"Automatic selection requires instructional evidence alongside the topic anchor, favoring explicit tutorials, lectures, overviews, courses, demonstrations, documentaries, and museum/gallery talks."}})

    public_packs=[{"slug":p["slug"],"name":p["name"],"kind":p.get("kind") or "extension","default":bool(p.get("default")),"description":p.get("description") or "","topics":[s for s in p.get("topics") or [] if s in topics],"coverage":pack_stats[p["slug"]]["coverage"],"available":pack_stats[p["slug"]]["available"]} for p in packs]
    topic_meta={slug:{"name":t["name"],"school_slug":t["school_slug"],"concepts":t.get("concepts") or [],"hints":[t["name"],*(t.get("aliases") or []),*(t.get("concepts") or [])],"required":bool(t.get("required"))} for slug,t in topics.items()}
    lookup_payload={"schema":"civweave.open-learning-media-lookup.v1","built_at":catalog.get("built_at"),"pack_registry_revision":registry.get("revision"),"relevance_gate":summary["relevance_gate"],"pedagogy_gate":summary["pedagogy_gate"],"selection_gate":summary["selection_gate"],"packs":public_packs,"topic_meta":topic_meta,"topics":lookup}
    outputs={
      "catalog.json":catalog,"summary.json":summary,"lookup.json":lookup_payload,
      "relevance-audit.json":{"schema":"civweave.open-learning-media-relevance-audit.v3","built_at":catalog.get("built_at"),"before":len(before),"after":len(relevant),"rejected":len(before)-len(relevant),"topics":topic_stats,"rejected_samples":rel_rejected},
      "pedagogy-audit.json":{"schema":"civweave.open-learning-media-pedagogy-audit.v3","built_at":catalog.get("built_at"),"before":len(relevant),"after":len(pedagogical),"rejected":len(relevant)-len(pedagogical),"topics":topic_stats,"rejected_samples":ped_rejected},
      "selection-audit.json":{"schema":"civweave.open-learning-media-selection-audit.v3","built_at":catalog.get("built_at"),"before":len(pedagogical),"after":len(kept),"rejected":len(pedagogical)-len(kept),"topics":topic_stats,"packs":pack_stats,"rejected_samples":sel_rejected},
      "packs.json":{"schema":"civweave.open-learning-media-packs.v1","built_at":catalog.get("built_at"),"revision":registry.get("revision"),"default_pack":registry.get("default_pack"),"packs":public_packs,"topic_meta":topic_meta},
    }
    for name,payload in outputs.items(): (ROOT/name).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    required=[s for s,t in topics.items() if t.get("required")]; missing=[s for s in required if topic_stats[s]["records"]<=0 or topic_stats[s]["mesh_redistributable"]<=0]
    if missing: raise SystemExit("Required library topics lack selected redistributable media: "+", ".join(missing))
    unavailable=[s for s,i in pack_stats.items() if not i["available"]]
    if unavailable: raise SystemExit("Open Learning Media packs did not meet coverage policy: "+", ".join(unavailable))
    print(json.dumps({"records":len(kept),"mesh_redistributable":catalog["mesh_redistributable_count"],"required_topics":len(required),"packs":{s:{"coverage":i["coverage"],"records":i["records"]} for s,i in pack_stats.items()}},indent=2))
if __name__=="__main__": main()

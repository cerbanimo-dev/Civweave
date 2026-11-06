# Fruit of the Loom · Golden Path Reader
**A children's reading and creation project by CCCAMIRYNCIVWEAVE>CC**

Status: first implementation proposed in PR #992 to \`staging\`; never infer production release from this document.

## Golden for everyone
- Reading must work offline, without an account, ads, subscriptions, purchases, or mandatory AI calls.
- Preserve full control of text size, contrast, navigation, original-text mode, and private bookmarks.
- Keep authored words immutable. A magical "transformation" is a reversible reader overlay until an author explicitly approves a revised edition.
- Privacy by default: importing a file is device-local. Export and publication are distinct, affirmative user actions.
- Children: no direct-to-child chat, AI improvisation, behavioral profiling, public sharing, or user-generated content discovery by default. Reader guidance is **not** a content-safety or age-suitability classifier.
- Children access only human-reviewed age-appropriate books in a separately curated shelf. Caregiver/educator approvals must be explicit and reversible.
- Copyright: do not publish books or adaptations without the rights holder's authorization. For public naming, check potential conflicts with the existing Fruit of the Loom apparel trademark.

## Implemented first slice
The existing Maggieverse native reader remains the sole owner of EPUB/TXT/Markdown import, local bookshelf, pagination, cues, and bookmarks. The Golden Path is an optional overlay generated from existing page headings (or fallback milestones). It has bounded data, accessible waypoint buttons, gentle reading prompts, a source-preserving Original mode, and a compact metadata export. It does not rewrite text or upload files.

## Next slices
### 2. Author-controlled magical editions
Add a manuscript import preview comparing original and generated suggestions side-by-side. Any rewriting, illustration, translation, or tone adaptation is explicit opt-in, with traceable provenance, manual approval, rollback, and a complete diff. Do not alter characters, plot canon, or source text silently.

### 3. Young readers' curated library
Implement separate age-suitability human review and guardian/educator publication permissions. Offer beginner/independent/advanced reading journeys with noncompetitive encouragement, optional read-aloud using local system speech where available, dyslexia-friendly settings, and no tracking of children beyond device-local opt-in reading state.

### 4. Creator export and e-ink
Export approved, standalone EPUB 3 and accessible HTML/text editions plus an optional offline bundle for the XTEINK X4 Pro / CrossPoint Reader. The static EPUB can encode the approved content and waypoints, but not live browser-only effects; keep the reading experience meaningful without scripting.

### 5. Civweave learning connection
Permit manually chosen passages to become Living School learning journeys, Quest reflections, or Guild review submissions. Respect the existing one-chat owner and signed Guild review authorization. No auto-publishing, automatic inference spending, or hidden third-party uploads.

## Minimum release checks
- Reader contract CI green on this branch.
- Core shell and repository CI reviewed and green before staging merge.
- Test on Android, iOS Safari, desktop, offline PWA, and e-ink EPUB export.
- Verify accessibility including screen reader focus order, reduced motion, keyboard navigation and ≥44px touch targets.
- Manually review all materials offered to children.

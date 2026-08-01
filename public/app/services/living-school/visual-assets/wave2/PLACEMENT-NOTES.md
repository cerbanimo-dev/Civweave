# Living School visual-mode asset placement

## Six core screens

1. **Living Hall (home)** — Full Living School logo above the central tree. Mount the six learning-cycle icons as distinct destinations around the hall. Use `moss-welcome.png` near the lower-right guide position. Keep the central active-thread surface clear for the learner's current school, purpose, progress and next action.
2. **Curriculum Forge (generate)** — Use `moss-generate.png`, `curriculum-forge-pedestal.png`, and `curriculum-tree-frame.png`. The tree's six leaf sockets receive live generated modules. Keep the pedestal and adjacent parchment surface clear for intention, skill assessment, prerequisites, resources, difficulty and Generate/Revise controls.
3. **Great Library (teach)** — Use `moss-teach.png`, `lesson-open-book.png`, `research-magnifier.png`, and the lesson/research icons. The book pages receive live lesson content, creator media, citations, questions and Continue controls. Shelves and doors navigate; lesson text never belongs in the background.
4. **Practicum Conservatory (practice)** — Use `moss-practice.png`, `practice-workbench.png`, `answer-acorn-bell.png`, and the practice/peer icons. Reserve the workbench center for instructions, submissions, evidence, feedback and Cerbanimo handoff. Peer review opens from the separate roundtable overlay.
5. **Competency Tower (assess)** — Use `moss-assess.png`, `assessment-lectern.png`, and assessment/competency icons. The blank lectern panel receives quizzes, attempt count, rubric, targeted review and final-project gate. Keep results and retake guidance live and accessible.
6. **Credential Grove (reward)** — Use `moss-celebrate.png`, `credential-press.png`, progression rewards and credential scrolls. Acorns represent XP; leaves, feathers, flowers and scrolls represent demonstrated mastery. Keep the learner passport, competency history and cross-realm reward ledger as live data.

## Learning loop

`Generate curriculum → Learn → Practice → Assess → Credential → Choose next learning`

The home screen should always foreground the current and next steps while minimizing unrelated rooms.

## Interaction and data rules

- Moss remains a foreground layer so the pose changes with context.
- Acorns are Living School XP imagery, not FellowFare currency. Button-coins never appear here.
- All lesson text, curriculum nodes, media, answers, rubrics, progress values, attempt counts, certificates and learner names remain live UI.
- Generated certificates and credential assets have blank centers by design.
- Backgrounds must reserve clean mounting zones for the logo, Moss, route icons and the room's primary prop.
- Visual competency states should map to: Introduced, Practiced, Demonstrated, Verified, Assessed and Reinforcement.
- Maintain at least 44×44 CSS-pixel touch targets even when a visible icon is smaller.

## Asset groups

- `moss/` — six context poses
- `icons/` — curriculum and room navigation
- `rewards/` — XP, badges, mastery and credentials
- `props/` — blank physical surfaces for live interface mounting
- `branding/` — transparent Living School logo
- `sheets/` — complete transparent source sheets

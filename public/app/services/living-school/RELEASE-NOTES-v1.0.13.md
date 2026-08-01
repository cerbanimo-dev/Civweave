# Living School v1.0.13: Living Displays

The eight reusable chalkboard and hologram interface shells now reflect the live learning workflow.

## State contract

`empty` -> `editing` -> `processing` -> `completed` -> `updated` -> `reviewed`

Error and archived states are also supported.

## Golden pathway

Curriculum intake -> generated curriculum -> practicum -> submission -> mentor feedback -> credential progress.

The display layer reads the existing local-first Living School state, observes mounted forms and feeds, and adds in-world notices without replacing application handlers or moving data into a second store.

## Universal Merlin chat

Merlin is available inside Living School as a read-only conversational and generative companion. He can understand a filtered platform snapshot, but cannot route the learner, move intentions, or change records.

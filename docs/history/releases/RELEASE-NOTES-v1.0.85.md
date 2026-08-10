# Civweave 1.0.85

## Guide streaming and thinking visibility

- Interactive Weaveling/realm-guide model calls now request token streaming.
- Downloaded-local partial tokens render into the active chat instead of leaving the user on a static thinking placeholder.
- `<think>...</think>` reasoning is presented in a distinct Thinking disclosure while generation is active.
- Thinking collapses automatically when the final answer arrives and remains expandable with the completed assistant turn.
- Structured guide JSON streams the `answer` field when it becomes available rather than exposing raw JSON in chat.
- The canonical `guide-workspace-v242` remains the sole chat submission owner.

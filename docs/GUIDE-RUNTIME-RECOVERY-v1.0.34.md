# Guide runtime recovery v1.0.34

## User-facing repairs

- The Commonweave Working Campus now includes a real Weaveling message composer with a textarea, Send control, local conversation history, provider status, and the shared assistant runtime.
- Merlin's native Anarchadia chat now reaches the current `CommonweaveAssistantV141` runtime through a bounded compatibility bridge instead of waiting for the retired `CommonweaveGuideChatV153` script.
- A deliberately saved model credential is retained on the current device, restored when the installed app reopens, excluded from exports and handoffs, and removable through **Forget saved key**.
- Cerbanimo no longer enters a recursive validation-button mutation loop when a saved task or quest opens in review state.

## Cerbanimo freeze cause

The v156 validator watched the quest interface for DOM changes. For every task in review it removed its existing validation button and inserted an equivalent replacement. That replacement triggered the observer again, producing an unbounded render cycle on startup whenever review state already existed.

The recovery layer suppresses the recursive binder before it starts and installs an idempotent replacement. Controls are created only when absent and their text changes only when state actually changes.

## Credential boundary

Credentials remain browser-local and are not synchronized to a host node, exported weave, realm handoff, offline seed, or shared object. Persistence is explicit at settings-save time and can be revoked locally without changing the selected provider profile.

## Compatibility boundary

The `CommonweaveGuideChatV153` global is provided only as a compatibility adapter for native surfaces that have not yet migrated. It delegates generation to `CommonweaveAssistantV141`; it does not reload the retired overlay implementation.

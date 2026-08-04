# Bugfix trace v1.0.34

| Reported symptom | Confirmed cause | Repair |
|---|---|---|
| Weaveling had conversation text but no chat/send function | The Working Campus shipped only `#conversation`; no form or submit handler existed | Added an in-world composer and connected it to `CommonweaveAssistantV141` through the family loader |
| Cerbanimo froze on load | The AI validator's mutation observer deleted and recreated validation controls after every mutation, recursively triggering itself when review state existed | Disabled the recursive binder before boot and installed an idempotent state patcher |
| API key vanished between screens or restarts | Both model settings and the shared runtime intentionally stored secrets only in `sessionStorage` | Added device-local persistence at explicit settings-save time, startup restoration, and a Forget saved key control |
| Merlin reported that the shared guide runtime never became ready | Native Anarchadia still expected retired `CommonweaveGuideChatV153`, while the loader now installs `CommonweaveAssistantV141` | Added a compatibility adapter that delegates Merlin calls to the current runtime |

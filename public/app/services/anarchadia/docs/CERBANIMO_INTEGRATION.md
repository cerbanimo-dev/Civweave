# Cerbanimo-style offline PWA suite integration

## Boundary principle

Anarchadia holds constitutional artifacts and declared procedural authority claims. Cerbanimo remains the work, project, need, resource, proof, skill, and completion engine. Living School remains the learning journey system.

No sibling is allowed to silently reinterpret a record from another sibling as authority to act.

## Recommended suite topology

```text
Anarchadia PWA  ─┐
Cerbanimo PWA   ─┼─ manual bundle exchange or local suite broker
Living School  ─┘
```

The first integration should remain manual file exchange. A local suite broker can later provide replaceable storage and AI routing without introducing shared identity or automatic governance effects.

## Constitutional artifact event

Schema: `anarchadia.constitutional-artifact.v1`

Allowed fields:

- source community-scoped reference;
- artifact reference;
- artifact kind;
- declared version;
- declared status;
- conflict state;
- expiry;
- manual review required;
- automatic effect set to false;
- authority disclaimer.

Prohibited fields:

- civil identity or shared account ID;
- person, household, device, recovery, or stable cross-system ID;
- private dissent;
- reflection, attention, emotion, motivation, ideology, or susceptibility;
- person-level work, contribution, need, care, debt, eligibility, or ecological burden;
- proof-of-worth or completion evidence;
- raw databases;
- automatic governance effect.

## Cerbanimo receiving behavior

On import, Cerbanimo should:

1. validate the schema;
2. show the source, declared status, conflict state, expiry, and disclaimer;
3. require an explicit local human review;
4. create no task, allocation, role, permission, project mutation, or resource transfer automatically;
5. preserve a link to the exact imported artifact or checksum;
6. allow the import to be rejected, deleted locally, or marked contested;
7. continue functioning if the bridge is disabled or removed.

## Optional local AI broker

Anarchadia can request constitutional drafting from a host or parent shell with:

```js
window.addEventListener('anarchadia:ai-request', async event => {
  const { requestId, system, prompt, model } = event.detail;
  try {
    const text = await suiteModelBroker.generate({ system, prompt, model });
    window.dispatchEvent(new CustomEvent('anarchadia:ai-response', {
      detail: { requestId, text }
    }));
  } catch (error) {
    window.dispatchEvent(new CustomEvent('anarchadia:ai-response', {
      detail: { requestId, error: error.message }
    }));
  }
});
```

The broker should expose provider selection already used by the Cerbanimo suite: packaged/cloud subscription option, local model, local API, user-supplied Gemini key, or other approved provider. The broker, not Anarchadia, should own provider-specific networking policy.

## Future bridge activation gate

Before a live bridge exists, create a default-off bridge contract in Anarchadia that states:

- exactly one direction;
- exactly one purpose;
- exactly one recipient class;
- exact fields and metadata;
- copies, retries, acknowledgements, caches, and deduplication;
- retention, correction, revocation, and expiry;
- re-identification and onward-copy risks;
- failure-closed behavior;
- manual/no-bridge alternative;
- affected-human ratification and amendment path.

The current MVP exports the contract but refuses live activation.

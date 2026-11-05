# Starling Meeting Model Bridges — Thread 3

## Status
Feature-branch module and tests, **not yet wired into live meeting UI or deployed**.
Run `node --test scripts/test-starling-meeting-model-bridges-v1.mjs`.

## Contract with Thread 1 / Thread 2
The host validates the participant's actual guild membership and meeting permissions,
then issues a short-lived **proposal grant** containing meetingId, participantId,
capability: `propose`, and expiresAt (epoch milliseconds).
The grant shape is not cryptographically signed by this module; untrusted clients
must never be allowed to mint their own grants or invoke this module directly.

`proposeMeetingTurn({meetingId,participantId,grant,provider,config,events,prompt,silent})`
returns `{kind:'speech_proposal',meetingId,participantId,provider,model,text,requiresSpeechGrant:true}`.
It does **not** dispatch audio, an avatar animation, a chat post, or a meeting event.
It must only be called after Thread 2 schedules a candidate response; the silent
flag is a safety stop, not a scheduler. Set `silent:true` when the participant
should remain idle. No passive transcript event triggers generation by itself.

Thread 2's trusted controller separately issues a fresh **speech grant** containing
meetingId, participantId, capability: `speak`, expiresAt, and optional id.
`acceptSpeechProposal(proposal,speechGrant)` checks the matching scope and
returns an `authorized_speech` envelope. Before playing audio, Thread 2 must
*also* re-check the grant's signature or server-side record, cancellation,
participant mute status, active meeting, and that the grant has not been consumed.
The current helper checks only scope and expiry: it is not a replacement for
server-side authentication, concurrency control or one-time token consumption.

## Transport
- OpenAI: fixed official HTTPS chat completions endpoint, explicit model and
  server-owned API key, explicit externalConsent.
- Gemini: fixed official HTTPS generateContent API, explicit consent and server
  owned key.
- Local: Ollama `/api/chat` or llama.cpp `/v1/chat/completions` on loopback.
  A local model listening on another device requires a trusted relay on the
  same host; do not expose its port or allow browser-controlled arbitrary URLs.
- No silent cloud fallback. Failures return errors; meeting continues.

Do not log model request bodies, private context, API keys, or raw fetch headers.
The bridge filters to public transcript events plus recipient-scoped participant
events; upstream event classifications remain the host's responsibility.
The last 24 visible events are bounded to 8,000 characters each.

## Integration checklist
1. Thread 1: mount this host-side module in the chosen meeting backend, preserve
   credential isolation, and establish authoritative grant issuance.
2. Thread 2: call only when a scheduled participant has the floor or explicit
   thought/proposal permission; validate and consume speaking grants.
3. Thread 4: render only `authorized_speech`; stop audio/animation on revocation.
4. Thread 5: record authorized speech, source/provider and meeting event ID;
   exclude private prompts and secret provider metadata from shared transcript.
5. Add live streaming/cancellation, hosted-device relays, real provider smoke
   checks, and shared context persistence as follow-on milestones.

**Do not merge this PR expecting a functioning live meeting.** It is a
standalone transport/authorization boundary for integration.

/**
 * Starling Meeting Room: presentation-only, deterministic projection.
 *
 * The meeting session/turn authority is external (Thread 2).
 * This module NEVER grants speech, starts audio, invokes models or persists a second chat.
 * All snapshots are treated as untrusted and must come from the authenticated meeting owner.
 */
export const MAX_ROOM_PARTICIPANTS = 16;

const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/.test(value);
const clampName = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
const isConnected = p => p.connected !== false && p.present !== false;
const maySpeak = p => p.muted !== true && p.canSpeak !== false && isConnected(p);

export function positionParticipants(participants = []) {
  const result = [];
  const used = new Set();
  for (const p of Array.isArray(participants) ? participants : []) {
    if (!p || !safeId(p.id) || used.has(p.id)) continue;
    used.add(p.id);
    const seat = result.length;
    const angle = (seat / MAX_ROOM_PARTICIPANTS) * Math.PI * 2;
    result.push({
      id: p.id,
      seat,
      position: { x: Math.round(Math.sin(angle) * 280) / 100, y: 0, z: Math.round(Math.cos(angle) * 280) / 100 },
      facingRadians: (angle + Math.PI) % (Math.PI * 2),
    });
    if (result.length >= MAX_ROOM_PARTICIPANTS) break;
  }
  return result;
}

export function projectAvatarState(participant, session = {}) {
  if (!participant || !safeId(participant.id)) return 'absent';
  if (!isConnected(participant)) return 'disconnected';
  if (session.roomStatus !== 'live') return 'idle';
  if (participant.muted === true) return 'muted';
  // Both explicit session grant and current turn activity are needed.
  // Model output, confidence, audio levels, and local UI changes grant nothing.
  if (session.grantedSpeakerId === participant.id &&
      session.activeSpeakerId === participant.id &&
      maySpeak(participant)) return 'speaking';
  if (participant.handRaised === true) return 'requesting_turn';
  return 'listening';
}

export function projectMeetingRoom(session = {}) {
  const positions = positionParticipants(session.participants);
  const byId = new Map();
  for (const p of Array.isArray(session.participants) ? session.participants : []) {
    if (p && safeId(p.id) && !byId.has(p.id)) byId.set(p.id, p);
  }
  const avatars = positions.map(seat => {
    const p = byId.get(seat.id);
    return {
      ...seat,
      displayName: clampName(p.displayName) || seat.id,
      kind: p.kind === 'agent' ? 'agent' : 'human',
      state: projectAvatarState(p, session),
      // Audio playback is only enabled for a speaker authorized by the meeting owner.
      audioEnabled: projectAvatarState(p, session) === 'speaking',
    };
  });
  return { status: session.roomStatus === 'live' ? 'live' : 'idle', avatars };
}

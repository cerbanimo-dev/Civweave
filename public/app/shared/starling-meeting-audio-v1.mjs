import {projectMeetingRoom} from './starling-meeting-room-v1.mjs';

/**
 * Presentation media gate, NOT an authentication or speech permission authority.
 * The caller must verify meeting identity, membership, revision and grants before
 * providing an approved session snapshot and media stream. stop() is synchronous.
 */
export function createMeetingAudioPresenter({start, stop}) {
  if (typeof start !== 'function' || typeof stop !== 'function') throw new TypeError('start and stop callbacks are required');
  let current = null;
  let sessionId = null;
  let revision = -1;
  let disposed = false;
  let sessionClosed = false;
  const safeStop = id => { try { stop(id); } catch { /* never re-enable playback */ } };
  function update(snapshot) {
    if (disposed || sessionClosed) return null;
    const id = typeof snapshot?.sessionId === 'string' && /^[a-zA-Z0-9][\w.:-]{0,95}$/.test(snapshot.sessionId) ? snapshot.sessionId : null;
    const rev = snapshot?.revision;
    if (!id || !Number.isSafeInteger(rev) || rev < 0) {
      if (current !== null) safeStop(current);
      current = null;
      return null;
    }
    if (sessionId !== null && id !== sessionId) {
      if (current !== null) safeStop(current);
      current = null;
      // A crossover permanently retires the presenter: old-session frames cannot restart it.
      sessionClosed = true;
      return null;
    }
    if (rev <= revision) return current;
    sessionId = id;
    revision = rev;
    const room = projectMeetingRoom(snapshot);
    const audible = room.avatars.find(avatar => avatar.audioEnabled);
    const next = audible?.id ?? null;
    if (next === current) return current;
    if (current !== null) safeStop(current);
    current = null;
    if (next !== null) {
      try {
        start(next);
        current = next;
      } catch {
        // Autoplay restrictions or a detached media element must fail silent.
        safeStop(next);
      }
    }
    return current;
  }
  function dispose() {
    if (current !== null) safeStop(current);
    current = null;
    disposed = true;
  }
  return Object.freeze({update, dispose});
}

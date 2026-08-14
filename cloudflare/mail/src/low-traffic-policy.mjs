export const SYSTEM_MAIL_POLL_BACKOFF_MS = Object.freeze([
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

/**
 * Civweave Mail is event-driven for inbound delivery, so receiving a message never
 * waits for a poll. This policy is for optional background/agent polling and gossip
 * maintenance when there is no queued work.
 *
 * quotaPressure is a normalized 0..1 signal supplied by the caller from whatever
 * account/node budget telemetry it has available. Empty passes lengthen the interval
 * even without quota pressure; fresh work snaps the interval back to the first rung.
 */
export function recommendedWorkerInterval({
  emptyPasses = 0,
  quotaPressure = 0,
  hasQueuedWork = false,
} = {}) {
  if (hasQueuedWork) return SYSTEM_MAIL_POLL_BACKOFF_MS[0];
  const pressure = clamp(quotaPressure, 0, 1);
  const pressureRungs = pressure >= 0.95 ? 4 : pressure >= 0.8 ? 3 : pressure >= 0.6 ? 2 : pressure >= 0.4 ? 1 : 0;
  const idleRungs = clamp(Math.floor(Number(emptyPasses) || 0), 0, SYSTEM_MAIL_POLL_BACKOFF_MS.length - 1);
  return SYSTEM_MAIL_POLL_BACKOFF_MS[Math.max(pressureRungs, idleRungs)];
}

export function trafficMode({ quotaPressure = 0, emptyPasses = 0, hasQueuedWork = false } = {}) {
  if (hasQueuedWork) return 'active';
  const intervalMs = recommendedWorkerInterval({ quotaPressure, emptyPasses, hasQueuedWork });
  if (intervalMs >= SYSTEM_MAIL_POLL_BACKOFF_MS[4]) return 'low-traffic';
  if (intervalMs >= SYSTEM_MAIL_POLL_BACKOFF_MS[2]) return 'conserve';
  return 'normal';
}

export const LOW_TRAFFIC_POLICY = Object.freeze({
  schema: 'civweave.mail-traffic-policy.v1',
  inboundDelivery: 'event-driven-immediate',
  backgroundPolling: 'adaptive-backoff',
  resetsOnQueuedWork: true,
  intervalsMs: SYSTEM_MAIL_POLL_BACKOFF_MS,
});

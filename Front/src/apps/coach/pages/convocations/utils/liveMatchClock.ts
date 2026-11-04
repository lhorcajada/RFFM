import type { LiveMatchServerClock } from "../components/simulation/liveMatch.types";

/** Offset that converts device time into server time: serverNow ≈ deviceNow + offset. */
export function computeServerOffsetMs(serverNowUtc: string, deviceReceivedAtMs: number): number {
  return Date.parse(serverNowUtc) - deviceReceivedAtMs;
}

export function computeElapsedSeconds(
  clock: LiveMatchServerClock,
  serverOffsetMs: number,
  nowMs: number,
): number {
  if (clock.referenceUtc === null) return clock.baseSeconds;

  const referenceMs = Date.parse(clock.referenceUtc);
  // An unparseable reference cannot be trusted; show the frozen base instead of NaN.
  if (Number.isNaN(referenceMs)) return clock.baseSeconds;

  const serverNowMs = nowMs + serverOffsetMs;
  const runningSeconds = Math.max(0, Math.floor((serverNowMs - referenceMs) / 1000));
  return Math.max(0, clock.baseSeconds + runningSeconds);
}

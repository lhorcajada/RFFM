import client from "../../../core/api/client";
import type {
  LiveMatchParticipationPayload,
  SeasonPlayerStats,
  PlayerMatchRecord,
} from "../pages/convocations/components/simulation/liveMatch.types";

const BACKUP_PREFIX = "rffm_live" as const;

// ─── localStorage backup helpers ─────────────────────────────────────────────

function backupKey(eventId: string): string {
  return `${BACKUP_PREFIX}:${eventId}`;
}

export function saveLiveMatchBackup(eventId: string, data: object): void {
  try {
    localStorage.setItem(backupKey(eventId), JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

export function loadLiveMatchBackup<T>(eventId: string): T | null {
  try {
    const raw = localStorage.getItem(backupKey(eventId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearLiveMatchBackup(eventId: string): void {
  localStorage.removeItem(backupKey(eventId));
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Upserts the match participation data for all players in the event.
 * The backend performs an upsert (insert-or-update) keyed on (eventId, teamPlayerId).
 */
export async function saveMatchParticipation(
  eventId: string,
  payload: LiveMatchParticipationPayload,
): Promise<void> {
  await client.post(`/api/events/${eventId}/match-participation`, payload);
}

/**
 * Retrieves persisted match participation for this event.
 */
export async function getMatchParticipation(
  eventId: string,
): Promise<LiveMatchParticipationPayload | null> {
  try {
    const resp = await client.get(`/api/events/${eventId}/match-participation`);
    return resp.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns total minutes played per teamPlayerId for the team in the given season.
 */
export async function getSeasonPlayerMinutes(
  teamId: string,
  seasonId: string,
): Promise<Record<string, number>> {
  try {
    const resp = await client.get(`/api/catalog/team/${teamId}/season-minutes`, {
      params: { seasonId },
    });
    return resp.data ?? {};
  } catch {
    return {};
  }
}

/**
 * Deletes all match participation records for a given event + team (undoes a saved match).
 */
export async function deleteMatchParticipation(
  eventId: string,
  teamId: string,
): Promise<void> {
  await client.delete(`/api/events/${eventId}/match-participation`, {
    params: { teamId },
  });
}

/**
 * Returns aggregated season stats per player for the given team.
 */
export async function getSeasonPlayerStats(
  teamId: string,
): Promise<SeasonPlayerStats[]> {
  try {
    const resp = await client.get(`/api/catalog/team/${teamId}/season-stats`);
    return resp.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Returns per-match history for a specific team player, most recent first.
 */
export async function getPlayerMatchHistory(
  teamPlayerId: string,
): Promise<PlayerMatchRecord[]> {
  try {
    const resp = await client.get(`/api/catalog/team-player/${teamPlayerId}/match-history`);
    return resp.data ?? [];
  } catch {
    return [];
  }
}

export default {
  saveLiveMatchBackup,
  loadLiveMatchBackup,
  clearLiveMatchBackup,
  saveMatchParticipation,
  getMatchParticipation,
  getSeasonPlayerMinutes,
  deleteMatchParticipation,
  getSeasonPlayerStats,
  getPlayerMatchHistory,
};

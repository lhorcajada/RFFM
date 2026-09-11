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

export type MatchMinutesRow = {
  eventId: string;
  teamPlayerId: string;
  minutesPlayed: number;
  isStarter: boolean;
  /** Post-match free-text reason explaining reduced minutes; null when unset. */
  minutesReason?: string | null;
};

/**
 * Returns minutes played per (event, teamPlayer) for every finished match of the team.
 */
export async function getMatchMinutes(teamId: string): Promise<MatchMinutesRow[]> {
  try {
    const resp = await client.get(`/api/catalog/team/${teamId}/match-minutes`);
    return resp.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Sets or clears the post-match "minutes reason" free-text note on a single player's
 * existing match participation row, without touching any other field (minutes played,
 * starter status, cards, substitutions, etc.). Passing `null` (or an empty/blank string)
 * clears the field. Requires a participation row to already exist for this
 * (eventId, teamPlayerId) pair — the backend responds 404 otherwise.
 */
export async function updateMatchParticipationReason(
  eventId: string,
  teamPlayerId: string,
  reason: string | null,
): Promise<void> {
  await client.put(`/api/events/${eventId}/match-participation/${teamPlayerId}/reason`, { reason });
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

export type MinuteLimitSanction = {
  teamPlayerId: string;
  sanctionId: string;
  minutesLimit: number;
};

/**
 * Returns every active (Pending) minutes-limit sportive sanction targeting the given event, so
 * the live-match screen can warn the coach when a sanctioned player reaches their minute cap.
 */
export async function getEventMinuteLimitSanctions(
  eventId: string,
): Promise<MinuteLimitSanction[]> {
  try {
    const resp = await client.get(`/api/events/${eventId}/sanctions/minute-limits`);
    return resp.data ?? [];
  } catch {
    return [];
  }
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
  getMatchMinutes,
  updateMatchParticipationReason,
  deleteMatchParticipation,
  getSeasonPlayerStats,
  getPlayerMatchHistory,
  getEventMinuteLimitSanctions,
};

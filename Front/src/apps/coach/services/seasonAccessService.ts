import client from "../../../core/api/client";

export type SeasonAccessDemarcation = {
  id: number;
  name: string;
  code: string;
};

export type SeasonAccessSelectionPlayer = {
  id: string;
  federationPlayerCode: string;
  playerName?: string;
  displayName: string;
  teamCode: string;
  teamName: string;
  category: string;
  status?: string | null;
  birthYear: number | null;
  totalGoals?: number | null;
  possibleDemarcationIds: number[];
  idealDemarcationId: number | null;
  removedFromDate?: string | null;
};

export type SeasonAccessSelection = {
  id: string;
  seasonId: string;
  category: string;
  players: SeasonAccessSelectionPlayer[];
};

export type SeasonAccessPlayerPayload = {
  seasonId: string;
  category: string; // general category (e.g. Debutantes, Prebenjamines...)
  divisionCategory?: string | null; // specific division/category string (matches CAT_COLORS entries)
  federationPlayerCode: string;
  playerName: string;
  teamCode: string;
  teamName: string;
  birthYear: number | null;
  totalGoals?: number | null;
  possibleDemarcationIds: number[];
  idealDemarcationId: number | null;
  status?: string | null;
  score?: number | null;
  trialDayId?: string | null;
  notes?: string | null;
};

export async function getSeasonAccessSelection(
  seasonId: string,
  category: string,
): Promise<SeasonAccessSelection | null> {
  try {
    const resp = await client.get<SeasonAccessSelection>("/api/catalog/season-access", {
      params: { seasonId, category },
    });

    return resp.data ?? null;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

export async function getSeasonAccessSelectionsBySeason(seasonId: string): Promise<SeasonAccessSelection[]> {
  const resp = await client.get<SeasonAccessSelection[]>(`/api/catalog/season-access/season/${encodeURIComponent(seasonId)}`);
  return resp.data ?? [];
}

export async function saveSeasonAccessPlayer(
  payload: SeasonAccessPlayerPayload,
): Promise<SeasonAccessSelection | null> {
  const resp = await client.post<SeasonAccessSelection | null>("/api/catalog/season-access/players", payload);
  return resp.data ?? null;
}

export async function deleteSeasonAccessPlayer(
  seasonId: string,
  category: string,
  playerCode: string,
): Promise<SeasonAccessSelection | null> {
  const resp = await client.delete<SeasonAccessSelection | null>(`/api/catalog/season-access/players/${encodeURIComponent(playerCode)}`, {
    params: { seasonId, category },
  });

  return resp.data ?? null;
}

export async function getSeasonAccessDemarcations(): Promise<SeasonAccessDemarcation[]> {
  const resp = await client.get<SeasonAccessDemarcation[]>("/api/catalog/demarcations");
  return resp.data ?? [];
}

// Trial days

export type SeasonAccessTrialDay = {
  id: string;
  trialId: string;
  date: string; // ISO date string e.g. "2026-05-25"
  label: string | null;
};

// NOTE: Use `SeasonAccessTrialPlayerDto` returned by the server as the single
// source of truth for trial-day player ratings. The legacy `SeasonAccessTrialDayRating`
// typedef is removed to avoid divergent shapes in the client.

export type SeasonAccessTrialPlayerDto = {
  id: string;
  trialDayId: string;
  score: number | null;
  notes: string | null;
  idealDemarcationId: number | null;
  possibleDemarcationIds: number[];
  totalGoals: number | null;
  status: string | null;
  birthYear: number | null;
  category: string | null;
  teamCode: string | null;
  teamName: string | null;
  federationPlayerCode: string | null;
  playerName: string | null;
  removedFromDate: string | null;
};

export type CreateTrialDayPayload = {
  seasonId: string;
  generalCategory: string;
  date: string;
  label?: string | null;
};

export type UpdateTrialDayPayload = {
  date: string;
  label?: string | null;
};

export type UpsertTrialDayRatingPayload = {
  trialPlayerId: string;
  score: number | null;
  notes?: string | null;
  status?: string | null;
  idealDemarcationId?: number | null;
  possibleDemarcationIds?: number[];
  totalGoals?: number | null;
};

export async function getTrialDays(seasonId: string, category: string): Promise<SeasonAccessTrialDay[]> {
  const resp = await client.get<SeasonAccessTrialDay[]>("/api/catalog/season-access/trial-days", {
    params: { seasonId, category },
  });
  return resp.data ?? [];
}

export async function createTrialDay(payload: CreateTrialDayPayload): Promise<SeasonAccessTrialDay> {
  const resp = await client.post<SeasonAccessTrialDay>("/api/catalog/season-access/trial-days", payload);
  return resp.data;
}

export async function updateTrialDay(id: string, payload: UpdateTrialDayPayload): Promise<SeasonAccessTrialDay> {
  const resp = await client.put<SeasonAccessTrialDay>(`/api/catalog/season-access/trial-days/${encodeURIComponent(id)}`, payload);
  return resp.data;
}

export async function deleteTrialDay(id: string): Promise<void> {
  await client.delete(`/api/catalog/season-access/trial-days/${encodeURIComponent(id)}`);
}

export async function getTrialDayRatings(dayId: string): Promise<SeasonAccessTrialPlayerDto[]> {
  const resp = await client.get<SeasonAccessTrialPlayerDto[]>(
    `/api/catalog/season-access/trial-days/${encodeURIComponent(dayId)}/ratings`,
  );
  try {
    console.debug('[seasonAccessService] getTrialDayRatings', {
      dayId,
      count: resp?.data?.length ?? 0,
      sample: (resp?.data ?? []).slice(0, 50).map((r) => ({ id: r.id, federationPlayerCode: r.federationPlayerCode, trialPlayerId: r.federationPlayerCode ?? r.id, status: r.status, score: r.score })),
    });
  } catch {}

  return resp.data ?? [];
}

export async function removeTrialPlayerFromDay(dayId: string, trialPlayerId: string): Promise<SeasonAccessSelection | null> {
  const resp = await client.delete<SeasonAccessSelection | null>(
    `/api/catalog/season-access/trial-days/${encodeURIComponent(dayId)}/players/${encodeURIComponent(trialPlayerId)}`,
  );
  return resp.data ?? null;
}


export default {
  getSeasonAccessSelection,
  getSeasonAccessSelectionsBySeason,
  saveSeasonAccessPlayer,
  deleteSeasonAccessPlayer,
  getSeasonAccessDemarcations,
  getTrialDays,
  createTrialDay,
  updateTrialDay,
  deleteTrialDay,
  getTrialDayRatings,
  removeTrialPlayerFromDay,
};
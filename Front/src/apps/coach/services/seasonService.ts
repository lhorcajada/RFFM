import client from "../../../core/api/client";

export const COACH_ACTIVE_SEASON_CHANGED_EVENT = "rffm.coach_active_season_changed";

export type Season = {
  id: string;
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean | null;
  isActive?: boolean | null;
  preferredTeamId?: string | null;
};

function normalizeSeason(season: Season): Season {
  const active = season.active ?? season.isActive ?? false;

  return {
    ...season,
    active,
    isActive: season.isActive ?? active,
  };
}

function toIsoDateValue(date: Date): string {
  return date.toISOString();
}

function buildDefaultRange() {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  return {
    startDate: toIsoDateValue(startDate),
    endDate: toIsoDateValue(endDate),
  };
}

function buildSeasonPayload(
  name: string,
  isActive: boolean,
  startDate?: string,
  endDate?: string,
) {
  const defaults = buildDefaultRange();
  return {
    seasonName: name,
    isActive,
    startDate: startDate || defaults.startDate,
    endDate: endDate || defaults.endDate,
  };
}

function notifyActiveSeasonChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(COACH_ACTIVE_SEASON_CHANGED_EVENT));
}

export async function getActiveSeason(): Promise<Season | null> {
  try {
    const resp = await client.get<Season>(`/api/catalog/season/active` as any);
    return resp.data ? normalizeSeason(resp.data) : null;
  } catch (e) {
    return null;
  }
}

export async function getSeasons(clubId: string): Promise<Season[]> {
  if (!clubId) {
    throw new Error("clubId is required");
  }
  try {
    const resp = await client.get<Season[]>(`/api/catalog/seasons`, {
      params: { clubId },
    } as any);
    return (resp.data ?? []).map(normalizeSeason);
  } catch (e) {
    return [];
  }
}

export async function getSeason(id: string): Promise<Season | null> {
  try {
    const resp = await client.get<Season>(`/api/catalog/season/${id}` as any);
    return resp.data ? normalizeSeason(resp.data) : null;
  } catch (e) {
    return null;
  }
}

export async function createSeason(
  name: string,
  isActive: boolean = false,
  startDate?: string,
  endDate?: string,
  clubId?: string,
): Promise<void> {
  if (!clubId) {
    throw new Error("clubId is required");
  }

  await client.post(
    `/api/catalog/season` as any,
    { ...buildSeasonPayload(name, isActive, startDate, endDate), clubId }
  );
  notifyActiveSeasonChanged();
}

export async function updateSeason(
  id: string,
  name: string,
  isActive: boolean = false,
  startDate?: string,
  endDate?: string,
): Promise<void> {
  await client.put(`/api/catalog/season/${id}` as any, buildSeasonPayload(name, isActive, startDate, endDate));
  notifyActiveSeasonChanged();
}

export async function deleteSeason(id: string): Promise<void> {
  await client.delete(`/api/catalog/season/${id}` as any);
  notifyActiveSeasonChanged();
}

export default { getActiveSeason, getSeasons, getSeason, createSeason, updateSeason, deleteSeason };

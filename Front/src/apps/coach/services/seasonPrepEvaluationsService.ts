import client from "../../../core/api/client";
import type { PlayerRating } from "../types/playerRating";
import type { RecruitmentStatus } from "../pages/season-prep/SeasonPrep";

/** Minimal player record stored in the season-prep ratings endpoint */
export type EvalPlayer = {
  uniqueId: string;
  name: string;
  team?: string;
  teamCode?: string;
  position?: string;
  birthYear?: number;
  procedencia?: string;
  manualEntry?: boolean;
  rating?: PlayerRating;
  recruitmentStatus?: RecruitmentStatus;
  starter?: number;
  totalGoals?: number;
};

export async function getSeasonPrepEvaluations(
  fedSeason: string,
  sportEventId?: string | null
): Promise<EvalPlayer[] | null> {
  const params = new URLSearchParams({ fedSeason });
  if (sportEventId) params.set("sportEventId", sportEventId);
  const response = await client.get<EvalPlayer[]>(
    `/api/season-prep/evaluations?${params.toString()}`
  );
  if (response.status === 204) return null;

  const payload = response.data as unknown;
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: EvalPlayer[] }).data;
  }

  return null;
}

export async function upsertSeasonPrepEvaluations(
  fedSeason: string,
  sportEventId: string | null | undefined,
  players: EvalPlayer[]
): Promise<void> {
  await client.put("/api/season-prep/evaluations", {
    fedSeason,
    sportEventId: sportEventId ?? null,
    players,
  });
}

import client from "../../../core/api/client";
import type { PlayerEvaluation, RecruitmentStatus } from "../pages/season-prep/SeasonPrep";

/** Minimal player record stored in the evaluations endpoint */
export type EvalPlayer = {
  uniqueId: string;
  name: string;
  team?: string;
  teamCode?: string;
  position?: string;
  birthYear?: number;
  procedencia?: string;
  manualEntry?: boolean;
  evaluation?: PlayerEvaluation;
  recruitmentStatus?: RecruitmentStatus;
  starter?: number;
  totalGoals?: number;
};

export async function getSeasonPrepEvaluations(
  fedSeason: string
): Promise<EvalPlayer[] | null> {
  const response = await client.get<{ data: string; updatedAt: string }>(
    `/api/season-prep/evaluations?fedSeason=${encodeURIComponent(fedSeason)}`
  );
  if (response.status === 204 || !response.data?.data) return null;
  try {
    return JSON.parse(response.data.data) as EvalPlayer[];
  } catch {
    return null;
  }
}

export async function upsertSeasonPrepEvaluations(
  fedSeason: string,
  players: EvalPlayer[]
): Promise<void> {
  await client.put("/api/season-prep/evaluations", {
    fedSeason,
    data: JSON.stringify(players),
  });
}

import { client } from "../../../core/api/client";
import type { SeasonStats } from "./playerSeasonSummaryService";

export type ComparedPlayerStatus = "Licensed" | "Unlicensed" | "NotInTeam";

export type ComparedPlayer = {
  name: string;
  photoUrl: string | null;
  jerseyNumber: string | null;
  rffmPlayerId: string | null;
  teamPlayerId: string | null;
  status: ComparedPlayerStatus;
  stats: SeasonStats | null;
};

export type CoachSquadComparison = {
  isCoachTeam: boolean;
  teamId: string | null;
  teamName: string | null;
  players: ComparedPlayer[];
};

export async function getCoachSquadComparison(
  teamCode: string,
  season: string,
  competition: string,
  group: string,
): Promise<CoachSquadComparison> {
  const res = await client.get<CoachSquadComparison>(
    `teams/${encodeURIComponent(teamCode)}/coach-squad-comparison`,
    { params: { season, competition, group } },
  );
  return res.data;
}

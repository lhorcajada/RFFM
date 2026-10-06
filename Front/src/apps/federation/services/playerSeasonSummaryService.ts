import { client } from "../../../core/api/client";

export type SeasonStats = {
  called: number;
  starter: number;
  substitute: number;
  played: number;
  goals: number;
  yellow: number;
  red: number;
  doubleYellow: number;
};

export type PlayerSeasonTeam = {
  competitionName: string;
  groupName: string;
  teamName: string;
  teamPoints: number;
  teamPosition: number;
  teamShieldUrl: string | null;
};

export type PlayerSeasonSummary = {
  seasonId: number;
  seasonName: string;
  stats: SeasonStats;
  teams: PlayerSeasonTeam[];
};

export async function getPlayerSeasonSummary(
  playerId: string,
  season: string,
): Promise<PlayerSeasonSummary[]> {
  const res = await client.get<PlayerSeasonSummary[]>(
    `players/${encodeURIComponent(playerId)}/season-summary`,
    { params: { season } },
  );
  return res.data ?? [];
}

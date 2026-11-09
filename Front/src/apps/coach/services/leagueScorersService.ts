import client from "../../../core/api/client";

export type LeagueGoalType = "normal" | "penalty" | "ownGoal";

export type LeagueGoal = {
  minute: string;
  player: string;
  team: string;
  type: LeagueGoalType;
  seasonGoals: number | null;
};

export type LeagueMatch = {
  recordCode: string;
  date: string;
  time: string;
  home: string;
  away: string;
  homeGoals: string;
  awayGoals: string;
  isOwnTeam: boolean;
  pendingActa: boolean;
  goals: LeagueGoal[];
};

export type LeagueScorer = {
  rank: number;
  player: string;
  team: string;
  goals: number;
};

export type LeagueScorersResponse = {
  rounds: number[];
  round: number;
  matches: LeagueMatch[];
  scorers: LeagueScorer[];
};

export async function getLeagueScorers(teamId: string, round?: number): Promise<LeagueScorersResponse> {
  const resp = await client.get<LeagueScorersResponse>(
    `/api/teams/${encodeURIComponent(teamId)}/league-scorers`,
    { params: round === undefined ? undefined : { round } },
  );
  return resp.data;
}

export type RefreshLeagueActasResponse = {
  requested: number;
  stored: number;
  failed: number;
};

export async function refreshLeagueActas(teamId: string, round: number): Promise<RefreshLeagueActasResponse> {
  const resp = await client.post<RefreshLeagueActasResponse>(
    `/api/teams/${encodeURIComponent(teamId)}/league-scorers/actas`,
    null,
    { params: { round } },
  );
  return resp.data;
}

export default { getLeagueScorers, refreshLeagueActas };

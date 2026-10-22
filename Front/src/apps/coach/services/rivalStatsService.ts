import axios from "axios";
import client from "../../../core/api/client";
import type { PlayerSeason } from "../../../shared/components/ui/PlayerSeasonStats/PlayerSeasonStats";

export type RivalStatsStatus = "Pending" | "Running" | "Completed" | "Failed";

export type RivalStatsProgress = {
  status: RivalStatsStatus;
  totalPlayers: number;
  processedPlayers: number;
  failedPlayers: number;
  completedAt: string | null;
  nextRefreshAllowedAt: string | null;
  errorMessage: string | null;
};

export type RivalTeamSummary = {
  teamCode: string;
  teamName: string;
  shieldUrl: string | null;
  playerCount: number;
  isOwnTeam: boolean;
};

export type RivalStats = RivalStatsProgress & {
  ownTeamCode: string | null;
  teams: RivalTeamSummary[];
};

export type RivalPlayer = {
  playerCode: string;
  playerName: string;
  birthYear: number | null;
  position: string | null;
  seasons: PlayerSeason[];
};

export type RivalTeamStats = {
  teamCode: string;
  teamName: string;
  shieldUrl: string | null;
  players: RivalPlayer[];
};

export type MatchPrediction = {
  round: number;
  date: string | null;
  localTeamCode: string;
  localTeamName: string;
  localShieldUrl: string | null;
  visitorTeamCode: string;
  visitorTeamName: string;
  visitorShieldUrl: string | null;
  localWinProbability: number;
  drawProbability: number;
  visitorWinProbability: number;
  localExpectedGoals: number;
  visitorExpectedGoals: number;
  mostLikelyLocalGoals: number;
  mostLikelyVisitorGoals: number;
};

export type ProjectedStanding = {
  teamCode: string;
  teamName: string;
  shieldUrl: string | null;
  currentPosition: number;
  currentPoints: number;
  expectedPoints: number;
  mostLikelyPosition: number;
  championProbability: number;
  positionProbabilities: number[];
  attack: number;
  defense: number;
  squadStrength: number;
};

export type RivalSimulation = {
  playedMatches: number;
  pendingMatches: number;
  usesSquadStrength: boolean;
  ownTeamCode: string | null;
  iterations: number;
  matches: MatchPrediction[];
  standings: ProjectedStanding[];
};

function basePath(teamId: string): string {
  return `/api/teams/${encodeURIComponent(teamId)}/rival-stats`;
}

/** Estado de las estadísticas de la liga del equipo; null si todavía no se han generado. */
export async function getRivalStats(teamId: string): Promise<RivalStats | null> {
  try {
    // Se sondea mientras se generan: un fallo puntual no debe sacar al usuario a la página de error.
    const resp = await client.get<RivalStats>(basePath(teamId), { suppressErrorRedirect: true });
    return resp.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function requestRivalStats(teamId: string, refresh: boolean): Promise<RivalStatsProgress> {
  const resp = await client.post<RivalStatsProgress>(`${basePath(teamId)}/requests`, { refresh });
  return resp.data;
}

export async function getRivalTeamStats(teamId: string, teamCode: string): Promise<RivalTeamStats> {
  const resp = await client.get<RivalTeamStats>(`${basePath(teamId)}/teams/${encodeURIComponent(teamCode)}`);
  return resp.data;
}

export async function getRivalSimulation(teamId: string): Promise<RivalSimulation> {
  const resp = await client.get<RivalSimulation>(`${basePath(teamId)}/simulation`);
  return resp.data;
}

export default { getRivalStats, requestRivalStats, getRivalTeamStats, getRivalSimulation };

import axios from "axios";
import { client } from "../../../core/api/client";

export type SquadHistoryStatus = "Pending" | "Running" | "Completed" | "Failed";

export type SquadHistoryRequestResponse = {
  reportId: string;
  status: SquadHistoryStatus;
};

export type SquadHistoryRequest = {
  seasonId: number;
  teamName: string;
  refresh: boolean;
};

export type SquadHistoryTeam = {
  competitionCode: string;
  competitionName: string;
  groupCode: string;
  groupName: string;
  teamCode: string;
  teamName: string;
  clubName: string;
  teamShieldUrl: string | null;
  teamPoints: number;
  teamPosition: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  starts: number | null;
  callUps: number | null;
  source: "PlayerSheet" | "Actas";
  isIncomplete: boolean;
};

export type SquadHistorySeason = {
  seasonId: number;
  seasonName: string;
  teams: SquadHistoryTeam[];
};

export type SquadHistoryPlayer = {
  playerCode: string;
  playerName: string;
  birthYear: number | null;
  originTeamName: string | null;
  isIncomplete: boolean;
  seasons: SquadHistorySeason[];
};

export type SquadHistoryReport = {
  reportId: string;
  teamCode: string;
  teamName: string;
  seasonId: number;
  previousSeasonId: number | null;
  status: SquadHistoryStatus;
  totalPlayers: number;
  processedPlayers: number;
  failedPlayers: number;
  requestedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  isCandidateSquad: boolean;
  candidateSearchNote: string | null;
  players: SquadHistoryPlayer[];
};

export function squadHistoryPath(teamCode: string, seasonId: number): string {
  return `/federation/squad-history/${encodeURIComponent(teamCode)}?seasonId=${seasonId}`;
}

export async function requestSquadHistory(
  teamCode: string,
  request: SquadHistoryRequest,
): Promise<SquadHistoryRequestResponse> {
  const res = await client.post<SquadHistoryRequestResponse>(
    `teams/${encodeURIComponent(teamCode)}/squad-history/requests`,
    request,
  );
  return res.data;
}

export async function getSquadHistory(
  teamCode: string,
  seasonId: number,
): Promise<SquadHistoryReport | null> {
  try {
    const res = await client.get<SquadHistoryReport>(
      `teams/${encodeURIComponent(teamCode)}/squad-history`,
      { params: { seasonId } },
    );
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

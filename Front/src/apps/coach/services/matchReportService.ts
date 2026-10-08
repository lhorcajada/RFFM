import client from "../../../core/api/client";
import type { Acta } from "../../../shared/types/acta";

export type MatchReportAvailability = {
  eventId: string;
  codActa: string | null;
  hasLiveReport: boolean;
  hasFederationReport: boolean;
};

export type ReportPlayer = {
  teamPlayerId: string;
  name: string;
  dorsal: number | null;
  photoUrl: string | null;
  slotIndex: number | null;
  minutesPlayed: number;
};

export type ReportGoal = {
  minute: number;
  scorerName: string | null;
  scorerDorsal: number | null;
  isOwnTeam: boolean;
  scoreLocal: number;
  scoreVisitor: number;
};

export type ReportCard = {
  minute: number;
  half: number;
  cardType: "yellow" | "red";
  playerName: string | null;
  rivalDorsal: number | null;
  isRivalPlayer: boolean;
};

export type ReportSwap = {
  inPlayerName: string;
  outPlayerName: string | null;
};

export type ReportSubstitutionWindow = {
  windowIndex: number;
  isHalftime: boolean;
  minute: number;
  half: number;
  swaps: ReportSwap[];
};

export type LiveMatchReport = {
  formationName: string | null;
  matchDurationMinutes: number | null;
  starters: ReportPlayer[];
  bench: ReportPlayer[];
  goals: ReportGoal[];
  cards: ReportCard[];
  substitutionWindows: ReportSubstitutionWindow[];
};

export type MatchReport = {
  eventId: string;
  teamName: string | null;
  teamPhotoUrl: string | null;
  rivalName: string | null;
  rivalPhotoUrl: string | null;
  isHomeMatch: boolean;
  date: string | null;
  localGoals: string | null;
  visitorGoals: string | null;
  matchCategory: "League" | "Friendly" | "Tournament" | null;
  hasLiveReport: boolean;
  hasFederationReport: boolean;
  live: LiveMatchReport | null;
};

export async function getTeamMatchReports(teamId: string): Promise<MatchReportAvailability[]> {
  const resp = await client.get<MatchReportAvailability[]>(`/api/teams/${teamId}/match-reports`);
  return resp.data ?? [];
}

export async function getMatchReport(eventId: string): Promise<MatchReport> {
  const resp = await client.get<MatchReport>(`/api/events/${eventId}/match-report`);
  return resp.data;
}

export async function getEventFederationActa(eventId: string): Promise<Acta> {
  const resp = await client.get<Acta>(`/api/events/${eventId}/federation-acta`);
  return resp.data;
}

export default { getTeamMatchReports, getMatchReport, getEventFederationActa };

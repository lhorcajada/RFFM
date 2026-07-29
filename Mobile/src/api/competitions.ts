import { api } from './client';

export interface ClassificationRow {
  position: number;
  teamId: string;
  teamName: string;
  imageUrl: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface ClassificationResponse {
  teams: ClassificationRow[];
}

export interface Match {
  date: string;
  time: string;
  localTeamName: string;
  localTeamImageUrl: string;
  localGoals: number | null;
  visitorTeamName: string;
  visitorTeamImageUrl: string;
  visitorGoals: number | null;
  status: string;
}

export interface MatchDay {
  date: string;
  matchDayNumber: number;
  matches: Match[];
}

export interface CalendarResponse {
  matchDays: MatchDay[];
}

export interface NextMatchResponse {
  match: Match | null;
}

export const fetchTeamClassification = async (teamId: string): Promise<ClassificationResponse> => {
  const response = await api.get(`/api/mobile/teams/${teamId}/classification`);
  return response.data;
};

export const fetchTeamCalendar = async (teamId: string): Promise<CalendarResponse> => {
  const response = await api.get(`/api/mobile/teams/${teamId}/calendar`);
  return response.data;
};

export const fetchTeamNextMatch = async (teamId: string): Promise<NextMatchResponse> => {
  const response = await api.get(`/api/mobile/teams/${teamId}/next-match`);
  return response.data;
};

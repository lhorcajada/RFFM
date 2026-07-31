import { api } from './client';

export interface TeamRosterPlayer {
  teamPlayerId: string;
  playerId: string;
  name: string;
  lastName: string | null;
  urlPhoto: string | null;
  dorsal: number | null;
  alreadyLinked: boolean;
}

export interface PreviewClubCodeResponse {
  clubId: string;
  clubName: string;
  membershipKind: string;
}

export interface PreviewTeamCodeResponse {
  teamId: string;
  teamName: string;
  clubId: string;
  membershipKind: string;
  players: TeamRosterPlayer[];
}

export interface ValidateCodePayload {
  code: string;
  membershipKind: string;
}

export const previewClubCode = async (
  payload: ValidateCodePayload,
): Promise<PreviewClubCodeResponse> => {
  const response = await api.post('/api/invitations/club/preview', payload);
  return response.data;
};

export const previewTeamCode = async (
  payload: ValidateCodePayload,
): Promise<PreviewTeamCodeResponse> => {
  const response = await api.post('/api/invitations/team/preview', payload);
  return response.data;
};

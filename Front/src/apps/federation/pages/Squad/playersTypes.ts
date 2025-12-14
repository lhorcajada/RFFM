export type SelectedTeam = {
  id: string | number;
  name: string;
  url?: string;
  raw?: any;
};

export type Player = {
  id: number;
  name: string;
  url?: string;
  email?: string;
  playerId?: string | number | null;
  jerseyNumber?: string | number | null;
  age?: number | null;
  teamParticipations?: any[];
  raw?: any;
  matches?: any;
  cards?: any;
  competitions?: any[];
};

export type PlayersState = {
  players: Player[];
  ageCounts: Record<number, number>;
  groupCounts: Array<{
    competitionName: string;
    teamName: string;
    teamPoints: number;
    count: number;
  }>;
};

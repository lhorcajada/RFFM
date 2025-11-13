export interface StatisticsBySeason {
  seasonId: number;
  seasonName: string;
  dorsalNumber: string;
  position: string;
  categoryName: string;
  competitionName: string;
  groupName: string;
  teamName: string;
  teamPoints: number;
  matchesPlayed: number;
  goals: number;
  headLine: number;
  substitute: number;
  yellowCards: number;
  redCards: number;
  doubleYellowCards: number;
  teamParticipations?: Array<{
    competitionName: string;
    groupName: string;
    teamName: string;
    teamPoints: number;
  }>;
}

export interface PlayerDetailsResponse {
  statisticsBySeason: StatisticsBySeason[];
  playerId: number;
  playerName: string;
  ace: number;
}

export interface TeamPlayer {
  id?: number | string;
  name?: string;
  url?: string;
  link?: string;
  email?: string;
  playerId?: number | string;
  ace?: number;
  age?: number | string | null;
  teamParticipations?: Array<{
    competitionName: string;
    groupName: string;
    teamName: string;
    teamPoints: number;
    seasonId?: number;
    seasonName?: string;
  }>;
  [key: string]: any;
}

export type PlayersByTeamResponse = TeamPlayer[] | { players: TeamPlayer[] };

export default PlayerDetailsResponse;

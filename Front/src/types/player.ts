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
  age?: number;
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

export interface TeamBasicInfo {
  teamCode?: string;
  clubCode?: string;
  accessKey?: string;
  name?: string;
  clubShield?: string;
  clubName?: string;
  category?: string;
  categoryCode?: string | number;
  website?: string;
  fieldCode?: string | number;
  field?: string;
  trainingField?: string;
  correspondenceName?: string;
  correspondenceTreatment?: string;
  address?: string;
  locality?: string;
  province?: string;
  postalCode?: string | number;
  contactEmail?: string;
  phones?: string;
  playDay?: string | number;
  playSchedule?: string;
  fax?: string;
  delegates?: Array<{ id?: string | number; name?: string }>;
  assistants?: Array<{ id?: string | number; name?: string }>;
  technicians?: Array<{ id?: string | number; name?: string }>;
}

export interface TeamResponse {
  team: TeamBasicInfo;
  players: Array<{ playerId?: string | number; name?: string }>;
}

export interface MatchStreak {
  type?: string; // G/E/P
  color?: string;
}

export interface Classification {
  color?: string;
  position?: string;
  imageUrl?: string;
  teamId?: string;
  teamName?: string;
  played?: string;
  won?: string;
  lost?: string;
  drawn?: string;
  penalties?: string;
  goalsFor?: string;
  goalsAgainst?: string;
  homePlayed?: string;
  homeWon?: string;
  homeDrawn?: string;
  homePenaltyWins?: string;
  homeLost?: string;
  awayPlayed?: string;
  awayWon?: string;
  awayDrawn?: string;
  awayPenaltyWins?: string;
  awayLost?: string;
  points?: string;
  sanctionPoints?: string;
  homePoints?: string;
  awayPoints?: string;
  showCoefficient?: string;
  coefficient?: string;
  matchStreaks?: MatchStreak[];
}

export type PlayersByTeamResponse = TeamPlayer[] | { players: TeamPlayer[] };

export default PlayerDetailsResponse;

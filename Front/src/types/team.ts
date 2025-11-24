export interface Team {
  status: string;
  sessionOk: string;
  teamCode: string;
  clubCode: string;
  accessKey: string;
  teamName: string;
  clubShield: string;
  clubName: string;
  category: string;
  categoryCode: string;
  website: string;
  fieldCode: string;
  field: string;
  fieldPhoto: string;
  trainingField: string;
  correspondenceHolder: string;
  correspondenceTitle: string;
  correspondenceAddress: string;
  correspondenceCity: string;
  correspondenceProvince: string;
  correspondencePostalCode: string;
  correspondenceEmail: string;
  phones: string;
  playDay: string;
  playSchedule: string;
  fax: string;

  delegates: Delegate[];
  assistants: Assistant[];
  coaches: Coach[];
  players: Player[];
}

export interface Delegate {
  delegateCode: string;
  name: string;
}

export interface Assistant {
  assistantCode: string;
  name: string;
}

export interface Coach {
  coachCode: string;
  name: string;
}

export interface Player {
  playerId: string;
  seasonId: string;
  name: string;
  age: number;
  birthYear: number;
  team: string;
  teamCode: string;
  teamCategory: string;
  jerseyNumber: string;
  position: string;
  isGoalkeeper: boolean;
  photoUrl: string;
  teamShieldUrl: string;

  matches: PlayerMatches;
  cards: PlayerCards;

  competitions: PlayerCompetition[];
}

export interface PlayerMatches {
  called: number;
  starter: number;
  substitute: number;
  played: number;
  totalGoals: number;
  goalsPerMatch: number;
}

export interface PlayerCards {
  yellow: number;
  red: number;
  doubleYellow: number;
}

export interface PlayerCompetition {
  competitionName: string;
  competitionCode: string;
  groupCode: string;
  groupName: string;
  teamCode: string;
  teamName: string;
  clubName: string;
  teamPosition: number;
  teamPoints: number;
  teamShieldUrl: string;
  showStatistics: boolean;
}

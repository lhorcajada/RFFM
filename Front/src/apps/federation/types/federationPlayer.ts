export type FederationPlayerMatches = {
  called: number;
  starter: number;
  substitute: number;
  played: number;
  totalGoals: number;
  goalsPerMatch: number;
};

export type FederationPlayerCards = {
  yellow: number;
  red: number;
  doubleYellow: number;
};

export type FederationPlayerCompetitionParticipation = {
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
};

export type FederationPlayer = {
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
  matches: FederationPlayerMatches;
  cards: FederationPlayerCards;
  competitions: FederationPlayerCompetitionParticipation[];
};

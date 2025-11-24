export interface ClassificationMatchStreak {
  type?: string;
  color?: string;
}

export interface ClassificationTeam {
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
  matchStreaks?: ClassificationMatchStreak[];
  [key: string]: any;
}

export interface ClassificationResponse {
  teams: ClassificationTeam[];
}

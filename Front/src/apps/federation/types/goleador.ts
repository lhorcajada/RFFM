export interface Goleador {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName?: string;
  matchesPlayed: number;
  scores: number;
  penaltyScores: number;
  averageScores: number;
}

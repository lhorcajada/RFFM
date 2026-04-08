export type PlayerRating = {
  id: string;
  teamPlayerId: string;
  technical: number;
  tactical: number;
  physical: number;
  competitiveness: number;
  ratedAt: string;
  notes?: string | null;
};

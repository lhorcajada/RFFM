export interface GoalSector {
  startMinute: number;
  endMinute: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamGoalSectors {
  teamCode: string;
  teamName: string;
  matchesProcessed: number;
  sectors: GoalSector[];
  totalGoalsFor: number;
  totalGoalsAgainst: number;
}

export type TeamsGoalSectorsComparison = TeamGoalSectors[];

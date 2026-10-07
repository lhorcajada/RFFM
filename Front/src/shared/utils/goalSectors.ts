export interface GoalSector {
  startMinute: number;
  endMinute: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamGoalSectors {
  teamCode: string;
  teamName: string;
  matchTime: number;
  matchesProcessed: number;
  sectors: GoalSector[];
  totalGoalsFor: number;
  totalGoalsAgainst: number;
}

export type TeamsGoalSectorsComparison = TeamGoalSectors[];

export type SectorComparisonRow = {
  index: number;
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
  aGoals: number;
  aAgainst: number;
  bGoals: number;
  bAgainst: number;
};

function sortedSectors(team: TeamGoalSectors): GoalSector[] {
  return [...(team.sectors ?? [])].sort((x, y) => x.startMinute - y.startMinute);
}

export function buildSectorComparisonRows(
  teamA: TeamGoalSectors,
  teamB: TeamGoalSectors,
): SectorComparisonRow[] {
  const a = sortedSectors(teamA);
  const b = sortedSectors(teamB);
  const count = Math.max(a.length, b.length);

  return Array.from({ length: count }, (_, index) => {
    const sa = a[index] ?? b[index];
    const sb = b[index] ?? a[index];
    return {
      index,
      aStart: sa.startMinute,
      aEnd: sa.endMinute,
      bStart: sb.startMinute,
      bEnd: sb.endMinute,
      aGoals: a[index]?.goalsFor ?? 0,
      aAgainst: a[index]?.goalsAgainst ?? 0,
      bGoals: b[index]?.goalsFor ?? 0,
      bAgainst: b[index]?.goalsAgainst ?? 0,
    };
  }).filter((row) => row.aGoals || row.aAgainst || row.bGoals || row.bAgainst);
}

export function formatSectorLabel(row: SectorComparisonRow): string {
  const a = `${row.aStart}-${row.aEnd}'`;
  const b = `${row.bStart}-${row.bEnd}'`;
  return a === b ? a : `${a} / ${b}`;
}

import { describe, it, expect } from "vitest";
import {
  buildSectorComparisonRows,
  formatSectorLabel,
  type GoalSector,
  type TeamGoalSectors,
} from "../goalSectors";

function team(matchTime: number, sectors: Array<[number, number, number, number]>): TeamGoalSectors {
  return {
    teamCode: String(matchTime),
    teamName: `Equipo ${matchTime}`,
    matchTime,
    matchesProcessed: 1,
    totalGoalsFor: 0,
    totalGoalsAgainst: 0,
    sectors: sectors.map(
      ([startMinute, endMinute, goalsFor, goalsAgainst]): GoalSector => ({
        startMinute,
        endMinute,
        goalsFor,
        goalsAgainst,
      }),
    ),
  };
}

const ninety: Array<[number, number, number, number]> = [
  [1, 15, 1, 0],
  [16, 30, 0, 0],
  [31, 45, 0, 0],
  [46, 60, 0, 0],
  [61, 75, 0, 0],
  [76, 90, 0, 2],
];

const eighty: Array<[number, number, number, number]> = [
  [1, 14, 3, 0],
  [15, 27, 0, 0],
  [28, 40, 0, 0],
  [41, 54, 0, 0],
  [55, 67, 0, 0],
  [68, 80, 0, 1],
];

describe("goalSectors — comparación por tramo", () => {
  it("con la misma duración etiqueta el tramo con un único rango", () => {
    const rows = buildSectorComparisonRows(team(90, ninety), team(90, ninety));

    expect(formatSectorLabel(rows[0])).toBe("1-15'");
  });

  it("con distinta duración etiqueta el tramo con ambos rangos", () => {
    const rows = buildSectorComparisonRows(team(80, eighty), team(90, ninety));

    expect(formatSectorLabel(rows[0])).toBe("1-14' / 1-15'");
  });

  it("empareja los sectores por posición aunque los minutos difieran", () => {
    const rows = buildSectorComparisonRows(team(80, eighty), team(90, ninety));

    expect(rows[rows.length - 1]).toMatchObject({
      index: 5,
      aStart: 68,
      aEnd: 80,
      bStart: 76,
      bEnd: 90,
      aAgainst: 1,
      bAgainst: 2,
    });
  });

  it("omite los tramos sin goles de ningún equipo", () => {
    const rows = buildSectorComparisonRows(team(80, eighty), team(90, ninety));

    expect(rows.map((r) => r.index)).toEqual([0, 5]);
  });
});

import { describe, expect, it } from "vitest";
import { buildLeagueSnapshot } from "../leagueSnapshot";
import type { ClassificationTeam } from "../../../../../../shared/hooks/useClassification";
import type { CalendarMatch } from "../../../../../federation/types/calendarMatchDay";
import type { OwnRoundEntry } from "../../../results/utils/ownMatch";

const OWN = "6818362";

function team(teamId: string, teamName: string, position: number, points: number): ClassificationTeam {
  return { teamId, teamName, position, points, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
}

function match(local: [string, string, string], visitor: [string, string, string]): CalendarMatch {
  return {
    localTeamCode: local[0],
    localTeamName: local[1],
    localGoals: local[2],
    visitorTeamCode: visitor[0],
    visitorTeamName: visitor[1],
    visitorGoals: visitor[2],
    status: "1",
  } as CalendarMatch;
}

const teams = [team("100", "A.D. UNION CARRASCAL 'F'", 1, 9), team(OWN, "FEPE GETAFE III 'D'", 3, 7)];

const ownByRound: Record<number, OwnRoundEntry> = {
  3: match(["300", "S.A.D. A.V. CASERIO PERALES 'B'", "0"], [OWN, "FEPE GETAFE III 'D'", "4"]),
  1: match([OWN, "FEPE GETAFE III 'D'", "1"], ["200", "C.D. SANTA BARBARA GETAFE 'E'", "1"]),
  2: match(["400", "ASD MOSTOLES 'B'", "0"], [OWN, "FEPE GETAFE III 'D'", "2"]),
  4: match([OWN, "FEPE GETAFE III 'D'", ""], ["500", "A.D.C.R. LEMANS 'D'", ""]),
};

describe("buildLeagueSnapshot", () => {
  it("devuelve null si el equipo propio no está en la clasificación", () => {
    expect(buildLeagueSnapshot(teams, ownByRound, "999")).toBeNull();
    expect(buildLeagueSnapshot(teams, ownByRound, null)).toBeNull();
  });

  it("devuelve posición y puntos del equipo propio", () => {
    expect(buildLeagueSnapshot(teams, {}, OWN)).toMatchObject({ position: 3, points: 7, lastMatch: null, form: [] });
  });

  it("toma como último resultado la última jornada jugada, con los goles propios primero", () => {
    expect(buildLeagueSnapshot(teams, ownByRound, OWN)?.lastMatch).toEqual({
      round: 3,
      opponent: "S.A.D. A.V. CASERIO PERALES 'B'",
      mine: 4,
      theirs: 0,
      outcome: "V",
    });
  });

  it("no cuenta como jugados los partidos con goles vacíos", () => {
    expect(buildLeagueSnapshot(teams, ownByRound, OWN)?.form).toEqual(["E", "V", "V"]);
  });

  it("ignora las jornadas de descanso", () => {
    expect(buildLeagueSnapshot(teams, { ...ownByRound, 5: "bye" }, OWN)?.form).toHaveLength(3);
  });

  it("limita la racha a las cinco últimas jornadas jugadas, de la más antigua a la más reciente", () => {
    const rounds: Record<number, OwnRoundEntry> = {};
    const scores = ["0", "1", "1", "2", "0", "3"];
    scores.forEach((goals, i) => {
      rounds[i + 1] = match([OWN, "FEPE", goals], ["900", "Rival", "1"]);
    });
    expect(buildLeagueSnapshot(teams, rounds, OWN)?.form).toEqual(["E", "E", "V", "D", "V"]);
  });
});

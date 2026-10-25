import { describe, expect, it } from "vitest";
import type { CalendarMatch } from "../../../../../federation/types/calendarMatchDay";
import { isBye, isOwnMatch, isPlayed, isSuspended, ownOutcome, seasonSummary, splitRound } from "../ownMatch";

function match(overrides: Partial<CalendarMatch> = {}): CalendarMatch {
  return {
    matchRecordCode: "1",
    hasRecords: "",
    recordClosed: "",
    gameSituation: "",
    observations: "",
    date: "04-10-2026",
    time: "11:00",
    field: "Campo Municipal",
    fieldCode: "",
    status: "",
    statusReason: "",
    matchInProgress: "",
    provisionalResult: "",
    referee: "",
    penalties: "",
    extraTimeWin: "",
    extraTimeWinnerTeam: "",
    localTeamCode: "100",
    localTeamName: "Local CF",
    localTeamImageUrl: "",
    localTeamWithdrawn: "",
    localGoals: "",
    localPenalties: "",
    visitorTeamCode: "200",
    visitorTeamName: "Visitante UD",
    visitorTeamImageUrl: "",
    visitorTeamWithdrawn: "",
    visitorGoals: "",
    visitorPenalties: "",
    originRecordCode: "",
    ...overrides,
  };
}

describe("isOwnMatch", () => {
  it("reconoce el partido propio como local o visitante", () => {
    expect(isOwnMatch(match(), "100")).toBe(true);
    expect(isOwnMatch(match(), " 200 ")).toBe(true);
  });

  it("no reconoce partidos ajenos ni sin código de equipo", () => {
    expect(isOwnMatch(match(), "300")).toBe(false);
    expect(isOwnMatch(match(), null)).toBe(false);
  });
});

describe("isPlayed", () => {
  it("considera jugado un partido con goles numéricos en ambos lados", () => {
    expect(isPlayed(match({ localGoals: "0", visitorGoals: " 2 " }))).toBe(true);
  });

  it("no considera jugado un partido sin goles o con goles no numéricos", () => {
    expect(isPlayed(match())).toBe(false);
    expect(isPlayed(match({ localGoals: "-", visitorGoals: "1" }))).toBe(false);
  });

  it("no considera jugado un partido suspendido aunque tenga goles", () => {
    expect(isPlayed(match({ status: "3", localGoals: "1", visitorGoals: "0" }))).toBe(false);
  });
});

describe("isSuspended", () => {
  it("detecta el estado 3 de la RFFM como suspendido", () => {
    expect(isSuspended(match({ status: "3" }))).toBe(true);
    expect(isSuspended(match({ status: " 3 " }))).toBe(true);
    expect(isSuspended(match({ status: "1" }))).toBe(false);
  });
});

describe("isBye", () => {
  it("detecta «Descansa» en cualquier lado sin distinguir mayúsculas", () => {
    expect(isBye(match({ visitorTeamName: "DESCANSA" }))).toBe(true);
    expect(isBye(match())).toBe(false);
  });
});

describe("ownOutcome", () => {
  it("devuelve V, E o D desde el punto de vista del equipo local", () => {
    expect(ownOutcome(match({ localGoals: "2", visitorGoals: "1" }), "100")).toBe("V");
    expect(ownOutcome(match({ localGoals: "1", visitorGoals: "1" }), "100")).toBe("E");
    expect(ownOutcome(match({ localGoals: "1", visitorGoals: "3" }), "100")).toBe("D");
  });

  it("invierte el resultado cuando el equipo propio es visitante", () => {
    expect(ownOutcome(match({ localGoals: "0", visitorGoals: "2" }), "200")).toBe("V");
  });

  it("devuelve null si no se ha jugado o no es propio", () => {
    expect(ownOutcome(match(), "100")).toBeNull();
    expect(ownOutcome(match({ localGoals: "2", visitorGoals: "1" }), "300")).toBeNull();
  });
});

describe("splitRound", () => {
  const own = match({ matchRecordCode: "own" });
  const other = match({ matchRecordCode: "other", localTeamCode: "300", visitorTeamCode: "400" });

  it("separa el partido propio del resto", () => {
    expect(splitRound([other, own], "100")).toEqual({ own, ownBye: false, rest: [other] });
  });

  it("marca el descanso propio sin partido propio", () => {
    const bye = match({ matchRecordCode: "bye", visitorTeamCode: "", visitorTeamName: "Descansa" });
    expect(splitRound([bye, other], "100")).toEqual({ own: null, ownBye: true, rest: [other] });
  });

  it("deja ajenos los descansos de otros equipos al final del resto", () => {
    const otherBye = match({ matchRecordCode: "ob", localTeamCode: "500", visitorTeamCode: "", visitorTeamName: "Descansa" });
    expect(splitRound([otherBye, own, other], "100").rest).toEqual([other, otherBye]);
  });

  it("sin código de equipo devuelve todos los partidos en el resto", () => {
    expect(splitRound([own, other], null)).toEqual({ own: null, ownBye: false, rest: [own, other] });
  });
});

describe("seasonSummary", () => {
  it("suma victorias, empates, derrotas y goles de las jornadas jugadas", () => {
    const summary = seasonSummary(
      {
        1: match({ localGoals: "3", visitorGoals: "1" }),
        2: match({ localGoals: "2", visitorGoals: "2", localTeamCode: "200", visitorTeamCode: "100" }),
        3: match({ localGoals: "1", visitorGoals: "0", localTeamCode: "200", visitorTeamCode: "100" }),
        4: match(),
        5: "bye",
        6: match({ status: "3", localGoals: "4", visitorGoals: "0" }),
      },
      "100",
    );

    expect(summary).toEqual({ wins: 1, draws: 1, losses: 1, goalsFor: 5, goalsAgainst: 4 });
  });
});

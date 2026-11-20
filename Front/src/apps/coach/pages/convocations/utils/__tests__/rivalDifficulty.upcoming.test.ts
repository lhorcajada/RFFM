import { describe, expect, it } from "vitest";
import type { MatchPrediction, RivalSimulation } from "../../../../services/matchForecastService";
import { DEFAULT_DIFFICULTY_THRESHOLDS } from "../deconvocationFunnel";
import { ownWinProbabilityAgainst, upcomingDifficulties } from "../rivalDifficulty";

function own(round: number, rival: string, ownWin: number, home = true): MatchPrediction {
  return {
    round,
    date: null,
    localTeamCode: home ? "own" : rival,
    localTeamName: home ? "Mi Equipo" : rival,
    visitorTeamCode: home ? rival : "own",
    visitorTeamName: home ? rival : "Mi Equipo",
    localWinProbability: home ? ownWin : 0.1,
    drawProbability: 0.2,
    visitorWinProbability: home ? 0.1 : ownWin,
  } as MatchPrediction;
}

const simulation = (matches: MatchPrediction[]): RivalSimulation => ({ ownTeamCode: "own", matches }) as RivalSimulation;
const T = DEFAULT_DIFFICULTY_THRESHOLDS;

describe("upcomingDifficulties", () => {
  it("clasifica los partidos posteriores al rival actual, en orden de jornada", () => {
    const sim = simulation([own(5, "d", 0.8), own(3, "b", 0.2), own(2, "a", 0.5), own(4, "c", 0.5)]);

    expect(upcomingDifficulties(sim, "a", T, 5)).toEqual(["hard", "medium", "easy"]);
  });

  it("no incluye el partido actual ni los anteriores", () => {
    const sim = simulation([own(1, "z", 0.1), own(2, "a", 0.1), own(3, "b", 0.9)]);

    expect(upcomingDifficulties(sim, "a", T, 5)).toEqual(["easy"]);
  });

  it("se limita al número pedido de partidos", () => {
    const sim = simulation([own(1, "a", 0.5), ...[2, 3, 4, 5, 6, 7, 8].map((r) => own(r, `r${r}`, 0.2))]);

    expect(upcomingDifficulties(sim, "a", T, 5)).toHaveLength(5);
  });

  it("usa la probabilidad visitante cuando el equipo juega fuera", () => {
    const sim = simulation([own(1, "a", 0.5), own(2, "b", 0.2, false)]);

    expect(upcomingDifficulties(sim, "a", T, 5)).toEqual(["hard"]);
  });

  it("devuelve una lista vacía sin simulación o si el rival no aparece", () => {
    expect(upcomingDifficulties(null, "a", T, 5)).toEqual([]);
    expect(upcomingDifficulties(simulation([own(1, "x", 0.5)]), "a", T, 5)).toEqual([]);
    expect(upcomingDifficulties(simulation([own(1, "a", 0.5)]), null, T, 5)).toEqual([]);
  });
});

describe("localización del partido actual en el pronóstico", () => {
  it("encuentra al rival aunque el nombre difiera en siglas o puntuación (C.F., CD, UD)", () => {
    const sim = simulation([own(2, "C.D. Vallecas", 0.5), own(3, "b", 0.2)]);

    expect(upcomingDifficulties(sim, "Vallecas CF", T, 5)).toEqual(["hard"]);
    expect(ownWinProbabilityAgainst(sim, "Vallecas C.F.")).toBe(0.5);
  });

  it("encuentra al rival cuando un nombre contiene al otro", () => {
    const sim = simulation([own(2, "Atlético de Madrid B", 0.5)]);

    expect(ownWinProbabilityAgainst(sim, "Atlético de Madrid")).toBe(0.5);
  });

  it("sin coincidencia de nombre usa el primer partido pendiente desde la fecha del partido", () => {
    const dated = (round: number, date: string, win: number) => ({ ...own(round, `r${round}`, win), date });
    const sim = simulation([dated(1, "2026-10-01", 0.9), dated(2, "2026-10-21", 0.2), dated(3, "2026-10-28", 0.9)]);

    expect(ownWinProbabilityAgainst(sim, "Nombre distinto", "2026-10-21")).toBe(0.2);
    expect(upcomingDifficulties(sim, "Nombre distinto", T, 5, "2026-10-21")).toEqual(["easy"]);
  });

  it("no inventa un pronóstico sin nombre coincidente ni fecha", () => {
    const sim = simulation([own(2, "otro", 0.5)]);

    expect(ownWinProbabilityAgainst(sim, "Nombre distinto")).toBeNull();
  });
});

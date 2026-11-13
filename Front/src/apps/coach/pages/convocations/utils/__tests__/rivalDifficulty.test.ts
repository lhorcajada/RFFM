import { describe, expect, it } from "vitest";
import type { MatchPrediction, RivalSimulation } from "../../../../services/matchForecastService";
import { difficultyThresholdsFromRules, ownWinProbabilityAgainst } from "../rivalDifficulty";
import { DEFAULT_RULES } from "../rules/defaultRules";

function match(partial: Partial<MatchPrediction>): MatchPrediction {
  return {
    round: 1,
    date: null,
    localTeamCode: "own",
    localTeamName: "Mi Equipo",
    localShieldUrl: null,
    visitorTeamCode: "rival",
    visitorTeamName: "Vallecas CF",
    visitorShieldUrl: null,
    localWinProbability: 0.3,
    drawProbability: 0.3,
    visitorWinProbability: 0.4,
    localExpectedGoals: 1,
    visitorExpectedGoals: 1,
    mostLikelyLocalGoals: 1,
    mostLikelyVisitorGoals: 1,
    ...partial,
  } as MatchPrediction;
}

function simulation(matches: MatchPrediction[]): RivalSimulation {
  return { ownTeamCode: "own", matches } as RivalSimulation;
}

describe("ownWinProbabilityAgainst", () => {
  it("devuelve la probabilidad de victoria local cuando el equipo juega en casa", () => {
    expect(ownWinProbabilityAgainst(simulation([match({})]), "Vallecas CF")).toBe(0.3);
  });

  it("devuelve la probabilidad de victoria visitante cuando el equipo juega fuera", () => {
    const away = match({ localTeamCode: "rival", localTeamName: "Vallecas CF", visitorTeamCode: "own", visitorTeamName: "Mi Equipo" });

    expect(ownWinProbabilityAgainst(simulation([away]), "Vallecas CF")).toBe(0.4);
  });

  it("ignora tildes, mayúsculas y espacios al buscar al rival", () => {
    const m = match({ visitorTeamName: "Atlético  Vallecas" });

    expect(ownWinProbabilityAgainst(simulation([m]), "atletico vallecas")).toBe(0.3);
  });

  it("usa el partido más próximo cuando hay varios contra el mismo rival", () => {
    const later = match({ round: 9, localWinProbability: 0.9 });
    const sooner = match({ round: 2, localWinProbability: 0.2 });

    expect(ownWinProbabilityAgainst(simulation([later, sooner]), "Vallecas CF")).toBe(0.2);
  });

  it("devuelve null si el rival no aparece, no hay simulación o no hay nombre", () => {
    expect(ownWinProbabilityAgainst(simulation([match({})]), "Otro")).toBeNull();
    expect(ownWinProbabilityAgainst(null, "Vallecas CF")).toBeNull();
    expect(ownWinProbabilityAgainst(simulation([match({})]), null)).toBeNull();
  });
});

describe("difficultyThresholdsFromRules", () => {
  it("convierte los porcentajes de la regla en probabilidades", () => {
    expect(difficultyThresholdsFromRules(DEFAULT_RULES)).toEqual({ hardBelow: 0.4, easyAbove: 0.65 });
  });

  it("devuelve null si la regla de dificultad no está: el rival cuenta siempre como medio", () => {
    expect(difficultyThresholdsFromRules(DEFAULT_RULES.filter((r) => r.condition !== "rivalDifficulty"))).toBeNull();
  });
});

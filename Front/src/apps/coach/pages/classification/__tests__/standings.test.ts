import { describe, expect, it } from "vitest";
import {
  formatGoalDifference,
  getGapText,
  getStandingZone,
  getPlayedResults,
  getZoneLegend,
  pointsPerMatch,
  toForm,
} from "../standings";
import type { ClassificationTeamMatch } from "../../../../../shared/hooks/useClassification";

function team(position: number, points: number) {
  return {
    teamId: String(position),
    teamName: `Equipo ${position}`,
    position,
    points,
    played: 10,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

function match(overrides: Partial<ClassificationTeamMatch>): ClassificationTeamMatch {
  return {
    date: "2026-09-01T10:00:00",
    opponent: "Rival",
    result: "G",
    localGoals: 2,
    visitorGoals: 1,
    isLocal: true,
    scoreLeft: "2",
    scoreRight: "1",
    ...overrides,
  };
}

describe("getStandingZone", () => {
  const spots = { promotionSpots: 2, playoffSpots: 2, relegationSpots: 3 };

  it("asigna el ascenso a las plazas de ascenso de la liga", () => {
    expect(getStandingZone(2, 16, spots)).toBe("promotion");
  });

  it("asigna la promoción a las plazas que siguen al ascenso", () => {
    expect(getStandingZone(4, 16, spots)).toBe("playoff");
  });

  it("asigna el descenso a las últimas plazas de la liga", () => {
    expect(getStandingZone(14, 16, spots)).toBe("relegation");
  });

  it("deja sin zona a la mitad de la tabla", () => {
    expect(getStandingZone(5, 16, spots)).toBe("neutral");
  });

  it("no marca descenso cuando la liga no tiene descensos", () => {
    expect(getStandingZone(16, 16, { promotionSpots: 2, relegationSpots: 0 })).toBe("neutral");
  });

  it("no marca ninguna zona cuando la liga no tiene plazas configuradas", () => {
    expect(getStandingZone(1, 16, {})).toBe("neutral");
  });
});

describe("getZoneLegend", () => {
  it("muestra el rango de ascenso de la liga", () => {
    expect(getZoneLegend({ promotionSpots: 2, relegationSpots: 0 }, 16)).toEqual([
      { zone: "promotion", label: "Ascenso (1º–2º)" },
    ]);
  });

  it("muestra una sola posición cuando solo asciende el primero", () => {
    expect(getZoneLegend({ promotionSpots: 1 }, 16)).toEqual([
      { zone: "promotion", label: "Ascenso (1º)" },
    ]);
  });

  it("incluye la promoción y el descenso solo cuando la liga los tiene", () => {
    expect(getZoneLegend({ promotionSpots: 1, playoffSpots: 3, relegationSpots: 4 }, 16)).toEqual([
      { zone: "promotion", label: "Ascenso (1º)" },
      { zone: "playoff", label: "Promoción (2º–4º)" },
      { zone: "relegation", label: "Descenso (13º–16º)" },
    ]);
  });

  it("no muestra leyenda cuando la liga no tiene plazas configuradas", () => {
    expect(getZoneLegend({}, 16)).toEqual([]);
  });
});

describe("formatGoalDifference", () => {
  it("antepone el signo más a una diferencia positiva", () => {
    expect(formatGoalDifference(18, 12)).toBe("+6");
  });

  it("muestra el signo menos en una diferencia negativa", () => {
    expect(formatGoalDifference(6, 24)).toBe("-18");
  });
});

describe("pointsPerMatch", () => {
  it("usa coma decimal con un decimal", () => {
    expect(pointsPerMatch(20, 10)).toBe("2,0");
  });

  it("devuelve 0 cuando no se ha jugado ningún partido", () => {
    expect(pointsPerMatch(0, 0)).toBe("0,0");
  });
});

describe("toForm", () => {
  it("normaliza las rachas W/D/L a G/E/P", () => {
    expect(toForm([{ type: "W" }, { type: "d" }, { type: "L" }])).toEqual(["G", "E", "P"]);
  });
});

describe("getGapText", () => {
  const teams = [team(1, 26), team(2, 25), team(3, 20)];

  it("indica la ventaja del líder sobre el segundo", () => {
    expect(getGapText(teams, 0)).toBe("+1 sobre el 2º");
  });

  it("indica la distancia con el de arriba y con el de abajo", () => {
    expect(getGapText(teams, 1)).toBe("A 1 del 1º · +5 sobre el 3º");
  });

  it("indica solo la distancia con el de arriba para el último", () => {
    expect(getGapText(teams, 2)).toBe("A 5 del 2º");
  });
});

describe("getPlayedResults", () => {
  const now = new Date("2026-10-01T00:00:00");

  it("descarta los partidos futuros y las jornadas de descanso", () => {
    const results = getPlayedResults(
      [
        match({ opponent: "Pasado" }),
        match({ opponent: "Futuro", date: "2026-12-01T10:00:00" }),
        match({ opponent: "DESCANSA" }),
      ],
      now,
    );

    expect(results.map((r) => r.opponent)).toEqual(["Pasado"]);
  });

  it("ordena del más reciente al más antiguo", () => {
    const results = getPlayedResults(
      [
        match({ opponent: "Antiguo", date: "2026-09-01T10:00:00" }),
        match({ opponent: "Reciente", date: "2026-09-20T10:00:00" }),
      ],
      now,
    );

    expect(results.map((r) => r.opponent)).toEqual(["Reciente", "Antiguo"]);
  });
});

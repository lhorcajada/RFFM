import { describe, expect, it } from "vitest";
import { playerDataChips, playerDataRows, type PlayerData } from "../proposalPlayerData";

const base: PlayerData = {
  calledCount: 7,
  startsCount: 4,
  startsDataAvailable: true,
  minRequiredCalls: 6,
  weeklyTraining: { attendedTrainings: 2, totalTrainings: 3 } as PlayerData["weeklyTraining"],
  detail: [
    { rule: "Regla obligatoria", value: "Lesión", result: "mandatory" },
    { rule: "Desconvocado hace poco", value: "Última técnica hace 2 jornadas (ventana 5)", result: "protects" },
    { rule: "Mínimo de convocatorias", value: "7 de 6 exigidas", result: "doesNotProtect" },
    { rule: "Mínimo por posición", value: "Se mantiene el mínimo de su posición", result: "allows" },
    { rule: "Encaje en el puesto", value: "2.º de 5 como Delantero", result: "decides" },
  ],
};

describe("playerDataChips", () => {
  it("lista convocatorias, titularidades, mínimo de convocatorias y entrenos", () => {
    expect(playerDataChips(base)).toEqual(["7 conv.", "4 tit.", "Mín. conv: 6", "2/3 entrenos"]);
  });

  it("omite las titularidades sin datos y los entrenos si no hubo ninguno", () => {
    const chips = playerDataChips({
      ...base,
      startsDataAvailable: false,
      weeklyTraining: { attendedTrainings: 0, totalTrainings: 0 } as PlayerData["weeklyTraining"],
    });

    expect(chips).toEqual(["7 conv.", "Mín. conv: 6"]);
  });
});

describe("playerDataRows", () => {
  it("devuelve la regla y su valor sin el veredicto de la propuesta", () => {
    const rows = playerDataRows(base);

    expect(rows).toContainEqual({ label: "Desconvocado hace poco", value: "Última técnica hace 2 jornadas (ventana 5)" });
    expect(rows).toContainEqual({ label: "Encaje en el puesto", value: "2.º de 5 como Delantero" });
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["label", "value"]);
  });

  it("excluye las filas que son un motivo de la propuesta", () => {
    const labels = playerDataRows(base).map((row) => row.label);

    expect(labels).not.toContain("Regla obligatoria");
    expect(labels).not.toContain("Mínimo por posición");
  });
});

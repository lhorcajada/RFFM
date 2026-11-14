import { describe, expect, it } from "vitest";
import { buildInitialDraft, characteristicsFor, isComplete, planSave } from "../ratingSheet";
import { DEFAULT_SHEET_CATALOG, type SheetCatalog } from "../ratingCatalog";
import { FIELD_PLAYER_CHARACTERISTICS, type CharacteristicDef } from "../ratingConcepts";
import type { PlayerRating } from "../../../../types/playerRating";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const custom: CharacteristicDef = {
  key: "custom-a",
  label: "Juego aéreo ofensivo",
  categoryKey: "technical",
  isGoalkeeper: false,
  levels: Array.from({ length: 10 }, (_, i) => ({ level: i + 1, concept: `Texto ${i + 1}` })),
};

const withoutSpeed = FIELD_PLAYER_CHARACTERISTICS.filter((c) => c.key !== "physicalSpeed");

const catalog: SheetCatalog = {
  field: [...withoutSpeed, custom],
  goalkeeper: DEFAULT_SHEET_CATALOG.goalkeeper,
};

const player = { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Delantero" } as PlayerResponse;

function allAt(level: number, characteristics: CharacteristicDef[]) {
  return Object.fromEntries(characteristics.map((c) => [c.key, level]));
}

function rating(levels: Record<string, number>): PlayerRating {
  return {
    id: "r1",
    teamPlayerId: "juan",
    isGoalkeeper: false,
    physical: 5,
    technical: 5,
    tactical: 5,
    competitiveness: 5,
    ratedAt: "2026-11-02T00:00:00Z",
    notes: "Zurdo",
    answers: Object.entries(levels).map(([characteristicKey, level]) => ({
      characteristicKey,
      level,
      concept: "x",
      categoryKey: "physical" as const,
    })),
  };
}

describe("ratingSheet con el catálogo del equipo", () => {
  it("characteristicsFor usa el catálogo recibido y, sin él, los valores por defecto", () => {
    expect(characteristicsFor("field", catalog)).toBe(catalog.field);
    expect(characteristicsFor("field")).toBe(FIELD_PLAYER_CHARACTERISTICS);
  });

  it("el borrador parte de las respuestas de las capacidades visibles", () => {
    const draft = buildInitialDraft([player], { juan: rating({ physicalSpeed: 7, technicalDribbling: 6, "custom-a": 4 }) }, catalog);

    expect(draft.juan).toEqual({ technicalDribbling: 6, "custom-a": 4 });
  });

  it("una capacidad propia obliga a valorarla para completar la hoja", () => {
    expect(isComplete("field", allAt(5, withoutSpeed), catalog)).toBe(false);
    expect(isComplete("field", allAt(5, catalog.field), catalog)).toBe(true);
  });

  it("una capacidad oculta no hace falta para completar la hoja", () => {
    expect(isComplete("field", allAt(5, withoutSpeed), { ...catalog, field: withoutSpeed })).toBe(true);
  });

  it("al guardar incluye las capacidades propias con su texto y deja fuera las ocultas", () => {
    const levels = allAt(5, catalog.field);
    levels["custom-a"] = 8;

    const plan = planSave([player], { juan: levels }, { juan: {} }, { juan: rating({}) }, catalog);

    expect(plan.incompletePlayers).toEqual([]);
    const answers = plan.items[0].answers;
    expect(answers.find((a) => a.characteristicKey === "custom-a")).toEqual({
      characteristicKey: "custom-a",
      level: 8,
      concept: "Texto 8",
      categoryKey: "technical",
    });
    expect(answers.map((a) => a.characteristicKey)).not.toContain("physicalSpeed");
    expect(answers).toHaveLength(catalog.field.length);
    expect(plan.items[0].notes).toBe("Zurdo");
  });

  it("un jugador al que le falta la capacidad propia se avisa como incompleto", () => {
    const levels = allAt(5, withoutSpeed);

    const plan = planSave([player], { juan: levels }, { juan: {} }, {}, catalog);

    expect(plan.items).toEqual([]);
    expect(plan.incompletePlayers).toEqual([player]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildInitialDraft,
  characteristicsFor,
  isComplete,
  planSave,
  sheetOf,
  type SheetDraft,
} from "../ratingSheet";
import { FIELD_PLAYER_CHARACTERISTICS, GOALKEEPER_CHARACTERISTICS } from "../ratingConcepts";
import type { PlayerRating } from "../../../../types/playerRating";
import type { PlayerResponse } from "../../../../services/teamplayerService";

function player(id: string, position: string | null): PlayerResponse {
  return { id, name: id, alias: id, position };
}

function fullLevels(sheet: "field" | "goalkeeper", level: number): Record<string, number> {
  return Object.fromEntries(characteristicsFor(sheet).map((c) => [c.key, level]));
}

function ratingFrom(teamPlayerId: string, levels: Record<string, number>, notes: string | null = null): PlayerRating {
  return {
    id: `rating-${teamPlayerId}`,
    teamPlayerId,
    isGoalkeeper: false,
    physical: 0,
    technical: 0,
    tactical: 0,
    competitiveness: 0,
    ratedAt: "2026-09-01T00:00:00Z",
    notes,
    answers: Object.entries(levels).map(([characteristicKey, level]) => ({
      characteristicKey,
      level,
      concept: "x",
      categoryKey: "physical",
    })),
  };
}

const striker = player("striker", "Delantero");
const keeper = player("keeper", "Portero");

describe("ratingSheet — hoja de cada jugador", () => {
  it("asigna la hoja de porteros a un portero", () => {
    expect(sheetOf(keeper)).toBe("goalkeeper");
  });

  it("asigna la hoja de jugadores a un jugador sin posición", () => {
    expect(sheetOf(player("x", null))).toBe("field");
  });

  it("devuelve las características de cada hoja", () => {
    expect(characteristicsFor("field")).toBe(FIELD_PLAYER_CHARACTERISTICS);
    expect(characteristicsFor("goalkeeper")).toBe(GOALKEEPER_CHARACTERISTICS);
  });
});

describe("ratingSheet — borrador inicial", () => {
  it("parte de los niveles de la última valoración", () => {
    const draft = buildInitialDraft([striker], { striker: ratingFrom("striker", { physicalSpeed: 7 }) });

    expect(draft.striker).toEqual({ physicalSpeed: 7 });
  });

  it("deja sin niveles al jugador sin valoración", () => {
    expect(buildInitialDraft([striker], {}).striker).toEqual({});
  });

  it("ignora las respuestas que no pertenecen a la hoja del jugador", () => {
    const draft = buildInitialDraft([keeper], {
      keeper: ratingFrom("keeper", { physicalSpeed: 7, keeperReactionSpeed: 5 }),
    });

    expect(draft.keeper).toEqual({ keeperReactionSpeed: 5 });
  });
});

describe("ratingSheet — completo", () => {
  it("es completo cuando tiene nivel en todas las características de su hoja", () => {
    expect(isComplete("field", fullLevels("field", 5))).toBe(true);
  });

  it("es incompleto cuando falta una característica", () => {
    const { physicalSpeed: _omitted, ...rest } = fullLevels("field", 5);

    expect(isComplete("field", rest)).toBe(false);
  });
});

describe("ratingSheet — plan de guardado", () => {
  const baseline: SheetDraft = { striker: fullLevels("field", 5), keeper: fullLevels("goalkeeper", 5) };

  it("no guarda nada cuando no hay cambios", () => {
    const plan = planSave([striker, keeper], baseline, baseline, {});

    expect(plan.items).toEqual([]);
    expect(plan.incompletePlayers).toEqual([]);
  });

  it("guarda solo al jugador que ha cambiado, con todas sus respuestas", () => {
    const draft: SheetDraft = { ...baseline, striker: { ...baseline.striker, physicalSpeed: 8 } };

    const plan = planSave([striker, keeper], draft, baseline, {});

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].teamPlayerId).toBe("striker");
    expect(plan.items[0].isGoalkeeper).toBe(false);
    expect(plan.items[0].answers).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length);
  });

  it("resuelve el concepto y la categoría de cada respuesta desde el catálogo", () => {
    const draft: SheetDraft = { ...baseline, striker: { ...baseline.striker, physicalSpeed: 8 } };

    const answer = planSave([striker], draft, baseline, {}).items[0].answers.find(
      (a) => a.characteristicKey === "physicalSpeed",
    );

    expect(answer).toEqual({
      characteristicKey: "physicalSpeed",
      level: 8,
      concept: "Rápido — genera peligro con su aceleración y llegada",
      categoryKey: "physical",
    });
  });

  it("marca al portero como portero", () => {
    const draft: SheetDraft = { ...baseline, keeper: { ...baseline.keeper, keeperReactionSpeed: 9 } };

    expect(planSave([keeper], draft, baseline, {}).items[0].isGoalkeeper).toBe(true);
  });

  it("conserva las notas de la última valoración", () => {
    const draft: SheetDraft = { ...baseline, striker: { ...baseline.striker, physicalSpeed: 8 } };

    const plan = planSave([striker], draft, baseline, {
      striker: ratingFrom("striker", baseline.striker, "Zurdo cerrado"),
    });

    expect(plan.items[0].notes).toBe("Zurdo cerrado");
  });

  it("no guarda al jugador con cambios pero incompleto y lo devuelve como incompleto", () => {
    const rookie = player("rookie", "Defensa");

    const plan = planSave([rookie], { rookie: { physicalSpeed: 6 } }, { rookie: {} }, {});

    expect(plan.items).toEqual([]);
    expect(plan.incompletePlayers).toEqual([rookie]);
  });
});

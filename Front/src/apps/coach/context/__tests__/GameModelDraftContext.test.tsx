import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { GameModel, Scenario } from "../../types/gameModel";
import { GameModelDraftProvider, useGameModelDraft } from "../GameModelDraftContext";

function buildScenario(id: number, order: number, apiId?: string): Scenario {
  return {
    id,
    apiId,
    order,
    name: `Escenario ${order}`,
    context: "contexto",
    tacticalPrinciples: [{ id: 1, name: "Principio 1" }],
    subPrinciples: [
      {
        id: id * 100,
        apiId: `sp-${id}`,
        order: 1,
        label: "A",
        name: "Subprincipio A",
        context: "sp contexto",
        subSubPrinciples: [
          {
            id: id * 1000,
            apiId: `ssp-${id}`,
            order: 1,
            name: "Sub-subprincipio 1",
            action: "acción",
            essentialSkills: [
              { id: id * 10000, apiId: `sk-${id}`, name: "Habilidad", description: "desc" },
            ],
          },
        ],
      },
    ],
    mediaUrl: "https://example.com/media.png",
    mediaType: "image",
  };
}

function buildDraft(): GameModel {
  return {
    id: "draft-1",
    teamId: "team-1",
    name: "Modelo de prueba",
    season: "2025/2026",
    gameMoments: [
      {
        id: 1,
        name: "Momento 1",
        zones: [
          { id: 1, name: "Zona 1", scenarios: [buildScenario(1, 1), buildScenario(2, 2)] },
          { id: 2, name: "Zona 2", scenarios: [buildScenario(3, 1)] },
        ],
      },
      {
        id: 2,
        name: "Momento 2",
        zones: [
          { id: 1, name: "Zona 1", scenarios: [] },
          { id: 2, name: "Zona 2", scenarios: [] },
        ],
      },
    ],
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <GameModelDraftProvider initialDraft={buildDraft()} availablePrinciples={[]}>
      {children}
    </GameModelDraftProvider>
  );
}

describe("GameModelDraftContext reducer — MOVE_SCENARIO_LOCATION", () => {
  it("elimina el escenario de la zona origen y renumera los restantes de 1..N", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "MOVE_SCENARIO_LOCATION",
        fromMi: 0,
        fromZi: 0,
        si: 0,
        toMi: 1,
        toZi: 0,
        order: 1,
      });
    });

    const sourceZone = result.current.draft.gameMoments[0].zones[0];
    expect(sourceZone.scenarios).toHaveLength(1);
    expect(sourceZone.scenarios[0].name).toBe("Escenario 2");
    expect(sourceZone.scenarios[0].order).toBe(1);
  });

  it("añade el escenario a la zona destino conservando su contenido anidado íntegro", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "MOVE_SCENARIO_LOCATION",
        fromMi: 0,
        fromZi: 0,
        si: 0,
        toMi: 1,
        toZi: 0,
        order: 1,
      });
    });

    const targetZone = result.current.draft.gameMoments[1].zones[0];
    expect(targetZone.scenarios).toHaveLength(1);
    const moved = targetZone.scenarios[0];
    expect(moved.name).toBe("Escenario 1");
    expect(moved.order).toBe(1);
    expect(moved.subPrinciples).toHaveLength(1);
    expect(moved.subPrinciples[0].subSubPrinciples).toHaveLength(1);
    expect(moved.subPrinciples[0].subSubPrinciples[0].essentialSkills).toHaveLength(1);
    expect(moved.tacticalPrinciples).toEqual([{ id: 1, name: "Principio 1" }]);
    expect(moved.mediaUrl).toBe("https://example.com/media.png");
    expect(moved.mediaType).toBe("image");
  });

  it("cuando la acción omite order, usa la longitud actual de la zona destino + 1", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "MOVE_SCENARIO_LOCATION",
        fromMi: 0,
        fromZi: 1,
        si: 0,
        toMi: 0,
        toZi: 0,
      });
    });

    const targetZone = result.current.draft.gameMoments[0].zones[0];
    expect(targetZone.scenarios).toHaveLength(3);
    expect(targetZone.scenarios[2].order).toBe(3);
  });
});

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { GameModel, Principle, Scenario } from "../../types/gameModel";
import { GameModelDraftProvider, useGameModelDraft } from "../GameModelDraftContext";

function buildScenario(id: number, order: number, apiId?: string): Scenario {
  return {
    id,
    apiId,
    order,
    name: `Escenario ${order}`,
    context: "contexto",
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

function buildPrinciple(id: number, order: number, scenarios: Scenario[]): Principle {
  return {
    id,
    gameMomentId: 1,
    gameZoneId: 1,
    order,
    title: `Principio ${order}`,
    description: "descripción",
    scenarios,
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
          {
            id: 1,
            name: "Zona 1",
            principles: [buildPrinciple(1, 1, [buildScenario(1, 1), buildScenario(2, 2)])],
          },
          { id: 2, name: "Zona 2", principles: [buildPrinciple(2, 1, [buildScenario(3, 1)])] },
        ],
      },
      {
        id: 2,
        name: "Momento 2",
        zones: [
          { id: 1, name: "Zona 1", principles: [buildPrinciple(3, 1, [])] },
          { id: 2, name: "Zona 2", principles: [] },
        ],
      },
    ],
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <GameModelDraftProvider initialDraft={buildDraft()}>{children}</GameModelDraftProvider>
  );
}

describe("GameModelDraftContext reducer — Principio CRUD", () => {
  it("ADD_PRINCIPLE añade un principio vacío al final de la zona", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_PRINCIPLE", mi: 0, zi: 1 });
    });

    const zone = result.current.draft.gameMoments[0].zones[1];
    expect(zone.principles).toHaveLength(2);
    expect(zone.principles[1].title).toBe("");
    expect(zone.principles[1].order).toBe(2);
    expect(zone.principles[1].scenarios).toEqual([]);
  });

  it("UPD_PRINCIPLE actualiza título y descripción sin tocar sus escenarios", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_PRINCIPLE",
        mi: 0,
        zi: 0,
        pi: 0,
        changes: { title: "Nuevo título", description: "Nueva descripción" },
      });
    });

    const principle = result.current.draft.gameMoments[0].zones[0].principles[0];
    expect(principle.title).toBe("Nuevo título");
    expect(principle.description).toBe("Nueva descripción");
    expect(principle.scenarios).toHaveLength(2);
  });

  it("DEL_PRINCIPLE elimina el principio y renumera los restantes de 1..N", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_PRINCIPLE", mi: 0, zi: 0 });
    });
    act(() => {
      result.current.dispatch({ type: "DEL_PRINCIPLE", mi: 0, zi: 0, pi: 0 });
    });

    const zone = result.current.draft.gameMoments[0].zones[0];
    expect(zone.principles).toHaveLength(1);
    expect(zone.principles[0].order).toBe(1);
    expect(zone.principles[0].title).toBe("");
  });
});

describe("GameModelDraftContext reducer — escenarios direccionados por índice de principio", () => {
  it("ADD_SCENARIO añade un escenario al principio indicado", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_SCENARIO", mi: 0, zi: 0, pi: 0 });
    });

    const principle = result.current.draft.gameMoments[0].zones[0].principles[0];
    expect(principle.scenarios).toHaveLength(3);
    expect(principle.scenarios[2].order).toBe(3);
  });

  it("UPD_SCENARIO actualiza el escenario dentro de su principio", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "UPD_SCENARIO",
        mi: 0,
        zi: 0,
        pi: 0,
        si: 0,
        changes: { name: "Nuevo nombre" },
      });
    });

    const scenario = result.current.draft.gameMoments[0].zones[0].principles[0].scenarios[0];
    expect(scenario.name).toBe("Nuevo nombre");
  });

  it("DEL_SCENARIO elimina el escenario del principio y renumera los restantes", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "DEL_SCENARIO", mi: 0, zi: 0, pi: 0, si: 0 });
    });

    const principle = result.current.draft.gameMoments[0].zones[0].principles[0];
    expect(principle.scenarios).toHaveLength(1);
    expect(principle.scenarios[0].name).toBe("Escenario 2");
    expect(principle.scenarios[0].order).toBe(1);
  });
});

describe("GameModelDraftContext reducer — MOVE_SCENARIO_LOCATION (destino: principio)", () => {
  it("elimina el escenario del principio origen y renumera los restantes de 1..N", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "MOVE_SCENARIO_LOCATION",
        fromMi: 0,
        fromZi: 0,
        fromPi: 0,
        si: 0,
        toMi: 1,
        toZi: 0,
        toPi: 0,
        order: 1,
      });
    });

    const sourcePrinciple = result.current.draft.gameMoments[0].zones[0].principles[0];
    expect(sourcePrinciple.scenarios).toHaveLength(1);
    expect(sourcePrinciple.scenarios[0].name).toBe("Escenario 2");
    expect(sourcePrinciple.scenarios[0].order).toBe(1);
  });

  it("añade el escenario al principio destino conservando su contenido anidado íntegro", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "MOVE_SCENARIO_LOCATION",
        fromMi: 0,
        fromZi: 0,
        fromPi: 0,
        si: 0,
        toMi: 1,
        toZi: 0,
        toPi: 0,
        order: 1,
      });
    });

    const targetPrinciple = result.current.draft.gameMoments[1].zones[0].principles[0];
    expect(targetPrinciple.scenarios).toHaveLength(1);
    const moved = targetPrinciple.scenarios[0];
    expect(moved.name).toBe("Escenario 1");
    expect(moved.order).toBe(1);
    expect(moved.subPrinciples).toHaveLength(1);
    expect(moved.subPrinciples[0].subSubPrinciples).toHaveLength(1);
    expect(moved.subPrinciples[0].subSubPrinciples[0].essentialSkills).toHaveLength(1);
    expect(moved.mediaUrl).toBe("https://example.com/media.png");
    expect(moved.mediaType).toBe("image");
  });

  it("cuando la acción omite order, usa la longitud actual del principio destino + 1", () => {
    const { result } = renderHook(() => useGameModelDraft(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "MOVE_SCENARIO_LOCATION",
        fromMi: 0,
        fromZi: 1,
        fromPi: 0,
        si: 0,
        toMi: 0,
        toZi: 0,
        toPi: 0,
      });
    });

    const targetPrinciple = result.current.draft.gameMoments[0].zones[0].principles[0];
    expect(targetPrinciple.scenarios).toHaveLength(3);
    expect(targetPrinciple.scenarios[2].order).toBe(3);
  });
});

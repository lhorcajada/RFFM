import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTeamPositionFit = vi.hoisted(() => vi.fn());
const savePositionFitOrder = vi.hoisted(() => vi.fn());
const savePositionTraitWeights = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/positionFitService", () => ({
  getTeamPositionFit,
  savePositionFitOrder,
  savePositionTraitWeights,
}));

import { moveItem, usePositionFit } from "../usePositionFit";
import type { PositionFit } from "../../../../types/positionFit";

function position(key: PositionFit["position"], ids: string[], extra: Partial<PositionFit> = {}): PositionFit {
  return {
    position: key,
    confirmedWeekStart: null,
    isManual: false,
    candidates: ids.map((id, index) => ({ teamPlayerId: id, name: id.toUpperCase(), place: index + 1, fit: 4 - index, trend: "same" })),
    weights: { traitCoverage: "key" },
    ...extra,
  };
}

const serverData: PositionFit[] = [
  position("centerBack", []),
  position("defensiveMidfielder", ["a", "b", "c"]),
];

async function renderLoaded() {
  getTeamPositionFit.mockResolvedValue(serverData);
  const hook = renderHook(() => usePositionFit("team-1"));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("moveItem", () => {
  it("mueve un elemento a otra posición", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("no cambia la lista si el índice no es válido", () => {
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("usePositionFit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga los puestos del equipo", async () => {
    const { result } = await renderLoaded();

    expect(getTeamPositionFit).toHaveBeenCalledWith("team-1");
    expect(result.current.positions.map((p) => p.position)).toEqual(["centerBack", "defensiveMidfielder"]);
  });

  it("el orden de trabajo parte del orden del servidor y no hay cambios", async () => {
    const { result } = await renderLoaded();

    expect(result.current.orderOf("defensiveMidfielder")).toEqual(["a", "b", "c"]);
    expect(result.current.isDirty("defensiveMidfielder")).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("sube un candidato un lugar", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.move("defensiveMidfielder", "b", "up"));

    expect(result.current.orderOf("defensiveMidfielder")).toEqual(["b", "a", "c"]);
    expect(result.current.isDirty("defensiveMidfielder")).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("baja un candidato un lugar", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.move("defensiveMidfielder", "a", "down"));

    expect(result.current.orderOf("defensiveMidfielder")).toEqual(["b", "a", "c"]);
  });

  it("no mueve al primero hacia arriba ni al último hacia abajo", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.move("defensiveMidfielder", "a", "up"));
    act(() => result.current.move("defensiveMidfielder", "c", "down"));

    expect(result.current.orderOf("defensiveMidfielder")).toEqual(["a", "b", "c"]);
    expect(result.current.isDirty("defensiveMidfielder")).toBe(false);
  });

  it("arrastrar un candidato sobre otro lo coloca en su lugar", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.moveTo("defensiveMidfielder", "c", "a"));

    expect(result.current.orderOf("defensiveMidfielder")).toEqual(["c", "a", "b"]);
  });

  it("volver al orden original deja de contar como cambio", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.move("defensiveMidfielder", "b", "up"));
    act(() => result.current.move("defensiveMidfielder", "b", "down"));

    expect(result.current.isDirty("defensiveMidfielder")).toBe(false);
  });

  it("restablece el orden del servidor", async () => {
    const { result } = await renderLoaded();
    act(() => result.current.move("defensiveMidfielder", "b", "up"));

    act(() => result.current.reset("defensiveMidfielder"));

    expect(result.current.orderOf("defensiveMidfielder")).toEqual(["a", "b", "c"]);
  });

  it("guarda el orden del puesto y toma la respuesta como nuevo punto de partida", async () => {
    savePositionFitOrder.mockResolvedValue(
      position("defensiveMidfielder", ["b", "a", "c"], { confirmedWeekStart: "2026-11-09T00:00:00", isManual: true }),
    );
    const { result } = await renderLoaded();
    act(() => result.current.move("defensiveMidfielder", "b", "up"));

    await act(async () => {
      await result.current.save("defensiveMidfielder");
    });

    expect(savePositionFitOrder).toHaveBeenCalledWith("team-1", "defensiveMidfielder", ["b", "a", "c"]);
    expect(result.current.isDirty("defensiveMidfielder")).toBe(false);
    expect(result.current.positions.find((p) => p.position === "defensiveMidfielder")?.isManual).toBe(true);
  });

  it("los cambios de un puesto no afectan a otro", async () => {
    const { result } = await renderLoaded();

    act(() => result.current.move("defensiveMidfielder", "b", "up"));

    expect(result.current.isDirty("centerBack")).toBe(false);
  });

  it("guarda los pesos de un puesto y actualiza el puesto", async () => {
    savePositionTraitWeights.mockResolvedValue(position("defensiveMidfielder", ["a", "b", "c"], { weights: { traitCoverage: "sum" } }));
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.saveWeights("defensiveMidfielder", { traitCoverage: "sum" });
    });

    expect(savePositionTraitWeights).toHaveBeenCalledWith("team-1", "defensiveMidfielder", { traitCoverage: "sum" });
    expect(result.current.positions.find((p) => p.position === "defensiveMidfielder")?.weights.traitCoverage).toBe("sum");
  });

  it("indica error de carga si falla la API", async () => {
    getTeamPositionFit.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePositionFit("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it("indica error de carga cuando falta el equipo", async () => {
    const { result } = renderHook(() => usePositionFit(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });
});

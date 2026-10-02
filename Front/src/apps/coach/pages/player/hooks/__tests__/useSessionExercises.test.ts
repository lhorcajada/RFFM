import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { TrainingSessionDetail } from "../../../../types/training";
import { exercise } from "../../__tests__/exerciseFixtures";

const getExerciseByIdMock = vi.fn();
vi.mock("../../../../services/trainingService", () => ({
  default: { getExerciseById: (...args: unknown[]) => getExerciseByIdMock(...args) },
}));

import { useSessionExercises } from "../useSessionExercises";

const DETAIL: TrainingSessionDetail = {
  id: "ses-1",
  name: "Sesión",
  description: "",
  date: "2026-10-01T00:00:00",
  startTime: null,
  isAssociatedToPlan: false,
  targets: [],
  blocks: [
    {
      id: "b-1",
      order: 1,
      nombre: "Bloque",
      exercises: [
        { id: "e-1", exerciseId: "ex-1", position: 1 },
        { id: "e-2", exerciseId: "ex-2", position: 2 },
      ],
    },
    { id: "b-2", order: 2, nombre: "Bloque 2", exercises: [{ id: "e-3", exerciseId: "ex-1", position: 1 }] },
  ],
};

describe("useSessionExercises", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin detalle no pide nada", () => {
    const { result } = renderHook(() => useSessionExercises(null));

    expect(getExerciseByIdMock).not.toHaveBeenCalled();
    expect(result.current.exercisesById.size).toBe(0);
  });

  it("pide una vez cada ejercicio de la sesión y descarta los que no existen", async () => {
    getExerciseByIdMock.mockImplementation(async (id: string) => (id === "ex-1" ? exercise({ id: "ex-1" }) : null));

    const { result } = renderHook(() => useSessionExercises(DETAIL));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getExerciseByIdMock).toHaveBeenCalledTimes(2);
    expect([...result.current.exercisesById.keys()]).toEqual(["ex-1"]);
  });

  it("si falla la carga devuelve un mapa vacío", async () => {
    getExerciseByIdMock.mockRejectedValue(new Error("500"));

    const { result } = renderHook(() => useSessionExercises(DETAIL));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.exercisesById.size).toBe(0);
  });
});

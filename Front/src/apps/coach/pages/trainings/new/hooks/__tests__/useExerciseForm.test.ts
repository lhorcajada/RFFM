import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExerciseForm } from "../useExerciseForm";
import type { Exercise } from "../../../../../types/training";

vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn(), createExercise: vi.fn(), updateExercise: vi.fn(),
    uploadExerciseMedia: vi.fn(), createCondition: vi.fn(), updateCondition: vi.fn(), deleteCondition: vi.fn(),
  },
}));

const navigate = vi.fn();

describe("useExerciseForm — multi-tipo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isPhysical es true cuando el array types incluye Physical", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("types", ["Physical", "Technical"]));

    await waitFor(() => {
      expect(result.current.isPhysical).toBe(true);
      expect(result.current.isTechTac).toBe(true);
    });
  });

  it("isPhysical y isTechTac son ambos true cuando se seleccionan Physical y Tactical juntos (no son excluyentes)", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("types", ["Physical", "Tactical"]));

    await waitFor(() => {
      expect(result.current.isPhysical).toBe(true);
      expect(result.current.isTechTac).toBe(true);
    });
  });

  it("bloquea el guardado con un mensaje de error cuando no hay ningún tipo seleccionado", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("types", []));
    act(() => result.current.setField("name", "Ejercicio sin tipo"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/tipo/i);
    expect(trainingService.createExercise).not.toHaveBeenCalled();
  });
});

describe("useExerciseForm — ejercicio independiente del modelo de juego", () => {
  beforeEach(() => vi.clearAllMocks());

  it("el formulario nunca expone campos de vinculación al modelo de juego", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    expect(result.current.form).not.toHaveProperty("subSubPrincipleId");
    expect(result.current.form).not.toHaveProperty("subPrincipleId");
    expect(result.current.form).not.toHaveProperty("scenarioId");
    expect(result.current.form).not.toHaveProperty("essentialSkillIds");
  });

  it("handleSave crea el ejercicio sin ningún campo de modelo de juego en el payload", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ex-new" });
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Ejercicio sin vinculación"));
    act(() => result.current.setField("description", "Descripción"));
    act(() => result.current.setField("types", ["Tactical"]));
    act(() => result.current.setField("durationTotal", 30));
    act(() => result.current.setField("playersNumber", 8));
    act(() => result.current.setField("fieldSpace", "Media cancha"));

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.createExercise).toHaveBeenCalled();
    });

    const callArgs = trainingService.createExercise.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("subSubPrincipleId");
    expect(callArgs).not.toHaveProperty("subPrincipleId");
    expect(callArgs).not.toHaveProperty("scenarioId");
    expect(callArgs).not.toHaveProperty("essentialSkillIds");
  });
});

describe("useExerciseForm — methodology", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emptyExercise trae 'Integrado' como metodologia por defecto", async () => {
    const { emptyExercise: empty } = await import("../../constants");
    expect(empty.methodology).toBe("Integrado");
  });

  it("applyExercise carga la metodologia del ejercicio existente", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const exercise: Exercise = {
      id: "ex-1", name: "Ejercicio", description: "", types: ["Tactical"],
      section: "Principal", methodology: "Global", durationTotal: 10, playersNumber: 8, goalPeekersNumber: 0,
      fieldSpace: "", conditions: [],
    };

    act(() => result.current.loadExercise(exercise));

    await waitFor(() => {
      expect(result.current.form.methodology).toBe("Global");
    });
  });
});

describe("useExerciseForm — vínculo con Microciclo (SeasonPlan)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prellena form.microcicloId cuando se pasa el parámetro microcicloId", () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings", microcicloId: "micro-1" })
    );

    expect(result.current.form.microcicloId).toBe("micro-1");
  });

  it("no establece microcicloId cuando no se pasa el parámetro", () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    expect(result.current.form.microcicloId).toBeFalsy();
  });

  it("loadExercise conserva el microcicloId del ejercicio cargado", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const exercise: Exercise = {
      id: "ex-1", name: "Ejercicio", description: "", types: ["Tactical"],
      section: "Principal", methodology: "Global", durationTotal: 10, playersNumber: 8, goalPeekersNumber: 0,
      fieldSpace: "", conditions: [], microcicloId: "micro-2",
    };

    act(() => result.current.loadExercise(exercise));

    await waitFor(() => {
      expect(result.current.form.microcicloId).toBe("micro-2");
    });
  });
});

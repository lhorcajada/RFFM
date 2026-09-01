import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExerciseForm } from "../useExerciseForm";
import type { Exercise } from "../../../../../types/training";

vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn(), createExercise: vi.fn(), updateExercise: vi.fn(),
    uploadExerciseMedia: vi.fn(),
  },
}));

const navigate = vi.fn();

describe("useExerciseForm — campos por defecto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emptyExercise trae 'Situacional' como tipo por defecto y 2 niveles vacíos", async () => {
    const { emptyExercise } = await import("../../constants");
    expect(emptyExercise.tipo).toBe("Situacional");
    expect(emptyExercise.niveles).toHaveLength(2);
  });

  it("el formulario no expone campos de condiciones ni de microciclo", () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    expect(result.current).not.toHaveProperty("conditions");
    expect(result.current).not.toHaveProperty("handleAddCondition");
    expect(result.current.form).not.toHaveProperty("microcicloId");
  });
});

describe("useExerciseForm — validación al guardar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea el guardado con un mensaje de error cuando falta el nombre", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("objetivo", "Objetivo"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/nombre/i);
    expect(trainingService.createExercise).not.toHaveBeenCalled();
  });

  it("bloquea el guardado cuando falta el objetivo", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Ejercicio"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/objetivo/i);
    expect(trainingService.createExercise).not.toHaveBeenCalled();
  });

  it("bloquea el guardado cuando niveles tiene menos de 2 filas", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Ejercicio"));
    act(() => result.current.setField("objetivo", "Objetivo"));
    act(() => result.current.setField("logistica", "Logística"));
    act(() => result.current.setField("descripcion", "Descripción"));
    act(() => result.current.setField("niveles", [{ nivel: 1, valores: {} }]));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/nivel/i);
    expect(trainingService.createExercise).not.toHaveBeenCalled();
  });

  it("bloquea el guardado cuando una relación con el modelo no tiene Subprincipio elegido", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Ejercicio"));
    act(() => result.current.setField("objetivo", "Objetivo"));
    act(() => result.current.setField("logistica", "Logística"));
    act(() => result.current.setField("descripcion", "Descripción"));
    act(() =>
      result.current.setField("modelRelations", [
        { subprincipioId: "", isFoco: true, habilidadesImprescindibles: [], items: [] },
      ])
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/subprincipio/i);
    expect(trainingService.createExercise).not.toHaveBeenCalled();
  });

  it("guarda correctamente cuando todos los campos requeridos están completos", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ex-new" });
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Ejercicio completo"));
    act(() => result.current.setField("objetivo", "Objetivo claro"));
    act(() => result.current.setField("logistica", "12 min, 20 jugadores"));
    act(() => result.current.setField("descripcion", "Desarrollo completo"));

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.createExercise).toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();
  });

  it("emite una notificación de éxito al guardar correctamente", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ex-new" });
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const onSnackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", onSnackbar);

    act(() => result.current.setField("name", "Ejercicio completo"));
    act(() => result.current.setField("objetivo", "Objetivo claro"));
    act(() => result.current.setField("logistica", "12 min, 20 jugadores"));
    act(() => result.current.setField("descripcion", "Desarrollo completo"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSnackbar).toHaveBeenCalledTimes(1);
    expect((onSnackbar.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: "Ejercicio guardado",
      severity: "success",
    });

    window.removeEventListener("rffm.show_snackbar", onSnackbar);
  });

  it("emite una notificación de error cuando el guardado falla", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const onSnackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", onSnackbar);

    act(() => result.current.setField("name", "Ejercicio completo"));
    act(() => result.current.setField("objetivo", "Objetivo claro"));
    act(() => result.current.setField("logistica", "12 min, 20 jugadores"));
    act(() => result.current.setField("descripcion", "Desarrollo completo"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSnackbar).toHaveBeenCalledTimes(1);
    expect((onSnackbar.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: "Error al guardar el ejercicio",
      severity: "error",
    });

    window.removeEventListener("rffm.show_snackbar", onSnackbar);
  });
});

describe("useExerciseForm — carga de ejercicio existente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applyExercise carga el tipo del ejercicio existente", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const exercise: Exercise = {
      id: "ex-1",
      name: "Ejercicio",
      tipo: "Global",
      objetivo: "Objetivo",
      modelRelations: [],
      nivelesColumnas: ["Palanca 1"],
      niveles: [
        { nivel: 1, valores: {} },
        { nivel: 2, valores: {} },
      ],
      logistica: "10 min",
      descripcion: "Desc",
      isAssociatedToGameModel: false,
    };

    act(() => result.current.loadExercise(exercise));

    await waitFor(() => {
      expect(result.current.form.tipo).toBe("Global");
    });
  });
});

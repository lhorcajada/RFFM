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

describe("useExerciseForm — volver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al volver devuelve el estado de navegación recibido para que la pantalla anterior conserve su propio destino de vuelta", () => {
    const returnState = { returnTo: "/coach/trainings/content-board?clubId=club-1&teamId=team-1" };
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings/new-session?teamId=team-1", returnState })
    );

    act(() => result.current.handleCancel());

    expect(navigate).toHaveBeenCalledWith("/coach/trainings/new-session?teamId=team-1", {
      replace: true,
      state: returnState,
    });
  });
});

describe("useExerciseForm — volver tras crear un ejercicio", () => {
  beforeEach(() => vi.clearAllMocks());

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

  function fillRequiredFields(result: { current: ReturnType<typeof useExerciseForm> }) {
    act(() => result.current.setField("name", "Ejercicio completo"));
    act(() => result.current.setField("objetivo", "Objetivo claro"));
    act(() => result.current.setField("logistica", "12 min, 20 jugadores"));
    act(() => result.current.setField("descripcion", "Desarrollo completo"));
  }

  it("al volver tras crear un ejercicio devuelve su id a la pantalla anterior, junto al estado recibido", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ex-new" });
    const returnState = { returnTo: "/coach/trainings" };
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings/new-session?teamId=team-1", returnState })
    );

    fillRequiredFields(result);
    await act(async () => {
      await result.current.handleSave();
    });
    act(() => result.current.handleCancel());

    expect(navigate).toHaveBeenCalledWith("/coach/trainings/new-session?teamId=team-1", {
      replace: true,
      state: { returnTo: "/coach/trainings", createdExerciseId: "ex-new" },
    });
  });

  it("al volver tras guardar cambios en un ejercicio que ya existía no lo devuelve como ejercicio creado", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.updateExercise as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const returnState = { returnTo: "/coach/trainings" };
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings/new-session?teamId=team-1", returnState })
    );

    act(() => result.current.loadExercise(exercise));
    await waitFor(() => expect(result.current.savedExerciseId).toBe("ex-1"));
    await act(async () => {
      await result.current.handleSave();
    });
    act(() => result.current.handleCancel());

    expect(navigate).toHaveBeenCalledWith("/coach/trainings/new-session?teamId=team-1", {
      replace: true,
      state: returnState,
    });
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

  it("applyExercise carga el subtipo del ejercicio existente", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const exercise: Exercise = {
      id: "ex-1",
      name: "Ejercicio",
      tipo: "Situacional",
      subtipo: "Rondos",
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
      expect(result.current.form.subtipo).toBe("Rondos");
    });
  });

  it("applyExercise conserva las habilidades elegidas de cada sub-subprincipio vinculado", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    const exercise: Exercise = {
      id: "ex-1",
      name: "Ejercicio",
      tipo: "Situacional",
      objetivo: "Objetivo",
      modelRelations: [
        {
          id: "rel-1",
          subprincipioId: "sub-1",
          isFoco: true,
          habilidadesImprescindibles: ["Pase"],
          items: [{ id: "item-1", subSubPrincipioId: "ssp-1", isFoco: true, habilidades: ["Pase"] }],
        },
      ],
      nivelesColumnas: [],
      niveles: [
        { nivel: 1, valores: {} },
        { nivel: 2, valores: {} },
      ],
      logistica: "10 min",
      descripcion: "Desc",
      isAssociatedToGameModel: true,
    };

    act(() => result.current.loadExercise(exercise));

    await waitFor(() => {
      expect(result.current.form.modelRelations[0].items).toEqual([
        { subSubPrincipioId: "ssp-1", isFoco: true, habilidades: ["Pase"] },
      ]);
    });
  });

  const baseExercise: Exercise = {
    id: "ex-1",
    name: "Ejercicio",
    tipo: "Global",
    objetivo: "Objetivo",
    modelRelations: [],
    nivelesColumnas: [],
    niveles: [],
    logistica: "10 min",
    descripcion: "Desc",
    isAssociatedToGameModel: false,
  };

  it("usa los niveles por defecto al cargar un ejercicio con menos de 2 niveles", async () => {
    const { emptyExercise } = await import("../../constants");
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.loadExercise(baseExercise));

    await waitFor(() => expect(result.current.form.niveles).toEqual(emptyExercise.niveles));
  });

  it("conserva los niveles y el dibujo al cargar un ejercicio que ya los tiene", async () => {
    const { result } = renderHook(() =>
      useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" })
    );
    const niveles = [1, 2, 3].map((n) => ({ nivel: n, valores: { Toques: String(n) } }));

    act(() => result.current.loadExercise({ ...baseExercise, niveles, nivelesColumnas: ["Toques"], dibujo: "ref-1" }));

    await waitFor(() => expect(result.current.form.niveles).toEqual(niveles));
    expect(result.current.form.dibujo).toBe("ref-1");
  });

  it("emptyExercise no trae subtipo por defecto", async () => {
    const { emptyExercise } = await import("../../constants");
    expect(emptyExercise.subtipo).toBeNull();
  });
});
